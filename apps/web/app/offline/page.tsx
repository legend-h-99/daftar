"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#f7f8f7] px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-700 text-4xl font-extrabold text-white">
        د
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-extrabold text-gray-900">أنت غير متصل بالإنترنت</h1>
        <p className="text-sm text-gray-500">تحقق من اتصالك وحاول مجددًا</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="rounded-2xl bg-brand-700 px-6 py-3 text-sm font-bold text-white active:bg-brand-800"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
