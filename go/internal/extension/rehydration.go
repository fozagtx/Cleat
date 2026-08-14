package extension

import (
	"context"
	"fmt"
	"math/big"
	"os"
	"strconv"
	"strings"
	"time"

	"extension-scaffold/internal/machine"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
)

const rehydrationChunkSize uint64 = 2_000

var pledgeStatusArgs = abi.Arguments{
	{Type: mustABIType("uint8")},
	{Type: mustABIType("uint64")},
}

func (e *Extension) rehydrateFromChain() {
	if !strings.EqualFold(strings.TrimSpace(os.Getenv("REHYDRATION_ENABLED")), "true") {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	if err := loadPledgeRegistry(ctx, e.cleatStore()); err != nil {
		logger.Errorf("chain rehydration failed; extension remains fail-closed: %v", err)
		return
	}
	logger.Infof("chain rehydration completed")
}

func loadPledgeRegistry(ctx context.Context, store *machine.Store) error {
	rpcURL := strings.TrimSpace(os.Getenv("CHAIN_URL"))
	registryValue := strings.TrimSpace(os.Getenv("PLEDGE_REGISTRY_ADDRESS"))
	fromBlockValue := strings.TrimSpace(os.Getenv("REHYDRATION_FROM_BLOCK"))
	if rpcURL == "" || !common.IsHexAddress(registryValue) || fromBlockValue == "" {
		return fmt.Errorf("CHAIN_URL, PLEDGE_REGISTRY_ADDRESS, and REHYDRATION_FROM_BLOCK are required")
	}

	fromBlock, err := strconv.ParseUint(fromBlockValue, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid REHYDRATION_FROM_BLOCK: %w", err)
	}

	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return fmt.Errorf("dial chain: %w", err)
	}
	defer client.Close()

	latest, err := client.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("read latest block: %w", err)
	}

	registry := common.HexToAddress(registryValue)
	eventTopic := crypto.Keccak256Hash([]byte("PledgeStatusChanged(bytes32,address,uint8,uint64)"))
	for start := fromBlock; start <= latest; {
		end := start + rehydrationChunkSize - 1
		if end > latest {
			end = latest
		}
		logs, err := client.FilterLogs(ctx, ethereum.FilterQuery{
			FromBlock: new(big.Int).SetUint64(start),
			ToBlock:   new(big.Int).SetUint64(end),
			Addresses: []common.Address{registry},
			Topics:    [][]common.Hash{{eventTopic}},
		})
		if err != nil {
			return fmt.Errorf("read pledge events %d-%d: %w", start, end, err)
		}
		for _, event := range logs {
			if len(event.Topics) != 3 {
				return fmt.Errorf("invalid pledge event topics at transaction %s", event.TxHash.Hex())
			}
			values, err := pledgeStatusArgs.Unpack(event.Data)
			if err != nil {
				return fmt.Errorf("decode pledge event at transaction %s: %w", event.TxHash.Hex(), err)
			}
			status, err := chainPledgeStatus(values[0].(uint8))
			if err != nil {
				return err
			}
			financier := common.BytesToAddress(event.Topics[2].Bytes()[12:]).Hex()
			if status == machine.PledgeReleased {
				financier = ""
			}
			if err := store.LoadPledge(machine.PledgeRecord{
				Commitment: event.Topics[1].Hex(),
				Financier:  financier,
				Status:     status,
				UpdatedAt:  int64(values[1].(uint64)),
			}); err != nil {
				return err
			}
		}
		if end == latest {
			break
		}
		start = end + 1
	}

	store.CompleteRehydration()
	return nil
}

func chainPledgeStatus(status uint8) (string, error) {
	switch status {
	case 1:
		return machine.PledgeActive, nil
	case 2:
		return machine.PledgeReleased, nil
	case 3:
		return machine.PledgeDefault, nil
	default:
		return "", fmt.Errorf("invalid on-chain pledge status %d", status)
	}
}
