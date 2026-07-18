import Link from "next/link"

export function LegalFooterLinks() {
  return (
    <p className="text-center text-xs text-graphite-500">
      <Link href="/politica-privacidad" className="hover:text-emerald-700 hover:underline">
        Política de privacidad
      </Link>
      {" · "}
      <Link href="/terminos-servicio" className="hover:text-emerald-700 hover:underline">
        Términos del servicio
      </Link>
    </p>
  )
}
