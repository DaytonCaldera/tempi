import { signIn, signOut } from "next-auth/react"
import Button from "./ui/button"

export function SignIn({
  provider,
  ...props
}: { provider?: string } & React.ComponentPropsWithRef<typeof Button>) {
  return (
    <form
      action={async () => {
        await signIn(provider)
      }}
    >
      <Button {...props}>Iniciar Sesion</Button>
    </form>
  )
}

export function SignOut(props: React.ComponentPropsWithRef<typeof Button>) {
  return (
    <form
      action={async () => {
        await signOut({ redirect: true, callbackUrl: "/" })
      }}
      className="w-50 mt-6"
    >
      <Button className="w-full p-0" {...props}>
        Cerrar Sesion
      </Button>
    </form>
  )
}
