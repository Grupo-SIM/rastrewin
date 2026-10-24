import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <div aria-hidden="true" className="h-1 w-full [background:var(--rainbow)]" />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 pt-6 pb-10 text-center sm:pt-10">
        <Image
          src="/logo-rastrewin.svg"
          alt="Rastrewin"
          width={2078}
          height={564}
          loading="eager"
          className="h-8 w-auto sm:h-9"
        />

        <h1 className="mt-6 font-display text-[1.75rem] leading-[1.15] font-extrabold tracking-tight text-balance sm:mt-8 sm:text-4xl">
          Título provisório da VSL
        </h1>
        <p className="mt-3 text-base text-pretty text-ink-soft sm:text-lg">
          Subtítulo provisório explicando a promessa em uma frase.
        </p>
      </main>
    </div>
  );
}
