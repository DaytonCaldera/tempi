import { signIn, signOut } from "next-auth/react"
import Button from "./ui/button"
import { useTranslations } from "next-intl";

export function SignIn({
  provider,
  ...props
}: { provider?: string } & React.ComponentPropsWithRef<typeof Button>) {
  const t = useTranslations('');
  return (
    <form
      action={async () => {
        await signIn(provider)
      }}
    >
      <Button {...props}>{t('common.login')}</Button>
    </form>
  )
}

export function SignOut(props: React.ComponentPropsWithRef<typeof Button>) {
  const t = useTranslations('');
  return (
    <form
      action={async () => {
        await signOut({ redirect: true, callbackUrl: "/" })
      }}
      className="w-50 mt-6"
    >
      <Button className="w-full p-0" {...props}>
        {t('common.logout')}
      </Button>
    </form>
  )
}
