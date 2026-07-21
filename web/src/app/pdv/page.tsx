import { getSession } from "@/lib/session";
import PdvScreen from "./pdv-screen";

export default async function PdvPage() {
  const session = await getSession();

  return (
    <PdvScreen
      role={session?.role ?? "vendedor"}
      nomeUsuario={session?.nome ?? ""}
      lojaIdSessao={session?.lojaId ?? null}
      possuiSpedyConfigurado={session?.possuiSpedyConfigurado ?? false}
    />
  );
}
