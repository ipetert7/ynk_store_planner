import { redirect } from 'next/navigation'

export default function LoginPage() {
  redirect('/api/sso/consume?callbackUrl=/arriendos')
}
