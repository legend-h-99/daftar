export default function SupportLink({ ar = true }: { ar?: boolean }) {
  return <a href="mailto:info@daftar1.com" className="inline-flex min-h-11 max-w-full flex-wrap items-center justify-center text-sm underline underline-offset-4">
    {ar ? "المساعدة وطلبات الخصوصية: " : "Help and privacy requests: "}<bdi className="ms-1" dir="ltr">info@daftar1.com</bdi>
  </a>;
}
