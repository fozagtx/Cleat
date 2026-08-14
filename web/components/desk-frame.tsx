import { WrongNetworkCard } from "@/components/wrong-network";

export function DeskFrame({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="px-4 pb-16 pt-24 sm:px-8 sm:pb-20 sm:pt-10 lg:px-[30px]">
      <div className="mx-auto max-w-6xl">
        <p className="landing-mono text-xs tracking-[0.5px] text-[var(--landing-muted-fg)]">Cleat desk</p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.5px] sm:text-4xl">{title}</h1>
        {lede ? (
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--landing-muted-fg)]">{lede}</p>
        ) : null}
        <WrongNetworkCard />
        <div className="mt-6 flex flex-col gap-6">{children}</div>
      </div>
    </main>
  );
}
