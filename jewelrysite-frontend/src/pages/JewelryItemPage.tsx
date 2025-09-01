import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getJewelryItemById } from "../api/jewelry";

export default function JewelryItemPage() {
    const { id } = useParams<{ id: string }>();
    const [item, setItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Crossfade config
    const TRANSITION_MS = 400; // super quick, 0.4s

    // Crossfade state
    const [currentIdx, setCurrentIdx] = useState(0);
    const [pendingIdx, setPendingIdx] = useState<number | null>(null);
    const [fadingOut, setFadingOut] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const data = await getJewelryItemById(Number(id));
                setItem(data);
            } catch (e: any) {
                setError(e?.message ?? "Failed to load item");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    // Build gallery: images + video (if exists)
    const gallery = item
        ? [
            { type: "image", url: item.mainImageUrl, alt: item.name },
            ...(item.galleryImages ?? [])
                .filter((img: any) => img.url !== item.mainImageUrl)
                .map((img: any) => ({ type: "image", url: img.url, alt: item.name })),
            ...(item.videoUrl
                ? [{ type: "video", url: item.videoUrl, alt: "Video", poster: item.videoPosterUrl }]
                : [])
        ]
        : [];

    const selectedMedia = gallery[currentIdx];

    const beginFadeTo = (idx: number) => {
        if (idx === currentIdx || fadingOut || idx < 0 || idx >= gallery.length) return;
        setPendingIdx(idx);
        setFadingOut(true);
    };

    const handleTransitionEnd: React.TransitionEventHandler<HTMLDivElement> = (e) => {
        if (e.propertyName !== "opacity") return;
        if (fadingOut) {
            if (pendingIdx !== null) setCurrentIdx(pendingIdx);
            setFadingOut(false);
        } else {
            setPendingIdx(null);
        }
    };

    if (loading) return <main className="p-4">Loading…</main>;
    if (error) return <main className="p-4 text-red-600">{error}</main>;
    if (!item) return <main className="p-4">No item found.</main>;

    return (
        <div className="min-h-screen p-8 bg-[#fbfbfa] flex flex-col items-center">
            <h1 className="text-3xl font-bold text-[#bfa16a] mb-8 text-center w-full">{item.name}</h1>
            <div className="bg-white rounded-lg shadow-lg max-w-5xl w-full flex flex-row p-8 gap-8">
                {/* Gallery Thumbnails */}
                <div className="flex flex-col gap-4 items-center">
                    {gallery.map((media, idx) => {
                        const isActive = (pendingIdx ?? currentIdx) === idx;
                        return (
                            <div
                                key={idx}
                                className={`relative w-16 h-16 rounded-lg border cursor-pointer transition ring-2 ${isActive ? "ring-[#bfa16a]" : "ring-transparent"
                                    } bg-white`}
                                onClick={() => beginFadeTo(idx)}
                            >
                                {media.type === "image" ? (
                                    <img
                                        src={media.url}
                                        alt={media.alt || `Gallery ${idx + 1}`}
                                        className="w-full h-full object-cover rounded-lg"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-black flex items-center justify-center rounded-lg">
                                        {("poster" in media && (media as any).poster) ? (
                                            <img
                                                src={(media as any).poster}
                                                alt="Video thumbnail"
                                                className="w-full h-full object-cover rounded-lg"
                                            />
                                        ) : null}
                                        <svg
                                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                                            width="32"
                                            height="32"
                                            viewBox="0 0 32 32"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <circle cx="16" cy="16" r="16" fill="#bfa16a" fillOpacity="0.8" />
                                            <polygon points="13,10 24,16 13,22" fill="white" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <button
                        className="mt-2 w-10 h-10 flex items-center justify-center rounded-full shadow bg-white hover:bg-gray-100"
                        aria-label="Previous"
                        type="button"
                        disabled
                    >
                        <svg width="24" height="24" fill="#bfa16a" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="12" fill="#fff" />
                            <path d="M15 7l-5 5 5 5" stroke="#bfa16a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                {/* Main Display */}
                <div className="flex-1 flex items-center justify-center min-h-[400px]">
                    <div
                        className={`w-full max-h-[500px] transition-opacity ${fadingOut ? "opacity-0" : "opacity-100"
                            }`}
                        style={{
                            transitionDuration: `${TRANSITION_MS}ms`,
                            transitionTimingFunction: "ease-in-out",
                            background: selectedMedia?.type === "video" ? "#000" : "transparent"
                        }}
                        onTransitionEnd={handleTransitionEnd}
                    >
                        {selectedMedia?.type === "image" ? (
                            <img
                                src={selectedMedia.url}
                                alt={selectedMedia.alt}
                                className="w-full max-h-[500px] object-contain rounded-lg"
                            />
                        ) : selectedMedia ? (
                            <video
                                src={selectedMedia.url}
                                controls
                                autoPlay
                                muted
                                className="w-full h-[500px] object-contain rounded-lg"
                                poster={(selectedMedia as any).poster}
                            />
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Description and Price */}
            <div className="max-w-5xl w-full mt-8 bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Description</h2>
                <p className="text-gray-700">{item.description}</p>
                <div className="text-2xl font-semibold text-gray-900 mt-6">
                    {item.price ? `$${item.price}` : ""}
                </div>
            </div>
        </div>
    );
}

