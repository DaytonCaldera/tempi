import { getTranslations } from "next-intl/server";

/** Placeholder with the runner page's shape (header, sticky toolbar, product rows) while its stock loads. */
export default async function RunnerLoading() {
    const tCommon = await getTranslations('common');
    const bar = "bg-gray-200 rounded-lg animate-pulse";

    return (
        <div className="min-h-screen bg-gray-50" aria-busy="true">
            <span className="sr-only" role="status">{tCommon('loading')}</span>

            <div className="bg-white px-4 pt-6 pb-4 border-b border-gray-100">
                <div className="max-w-md mx-auto flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                        <div className={`${bar} h-7 w-3/4`} />
                        <div className={`${bar} h-3 w-32`} />
                        <div className={`${bar} h-3 w-20`} />
                    </div>
                    <div className={`${bar} w-11 h-11 rounded-2xl`} />
                </div>
            </div>

            <div className="px-4 py-3 border-b border-gray-100">
                <div className="max-w-md mx-auto space-y-2">
                    <div className={`${bar} h-14 rounded-2xl`} />
                    <div className={`${bar} h-12 rounded-2xl`} />
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 pt-4 space-y-2.5">
                <div className={`${bar} h-3 w-24`} />
                {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white p-2.5 pl-4 rounded-3xl border border-gray-100">
                        <div className="flex-1 space-y-2">
                            <div className={`${bar} h-4 w-3/4`} />
                            <div className={`${bar} h-3 w-16`} />
                        </div>
                        <div className={`${bar} w-8 h-7`} />
                        <div className={`${bar} w-14 h-14 rounded-2xl`} />
                        <div className={`${bar} w-14 h-14 rounded-2xl`} />
                    </div>
                ))}
            </div>
        </div>
    );
}
