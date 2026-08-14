package extension

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type decryptRequest struct {
	EncryptedMessage string `json:"encryptedMessage"`
}

type decryptResponse struct {
	DecryptedMessage string `json:"decryptedMessage"`
}

func (e *Extension) decrypt(ciphertext []byte) ([]byte, error) {
	if e.signPort <= 0 {
		return nil, fmt.Errorf("sign port is not configured")
	}
	body, err := json.Marshal(decryptRequest{
		EncryptedMessage: base64.StdEncoding.EncodeToString(ciphertext),
	})
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 10 * time.Second}
	response, err := client.Post(
		fmt.Sprintf("http://127.0.0.1:%d/decrypt", e.signPort),
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tee-node decrypt returned %d", response.StatusCode)
	}

	var payload decryptResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	plaintext, err := base64.StdEncoding.DecodeString(payload.DecryptedMessage)
	if err != nil {
		return nil, fmt.Errorf("decode plaintext: %w", err)
	}
	return plaintext, nil
}
