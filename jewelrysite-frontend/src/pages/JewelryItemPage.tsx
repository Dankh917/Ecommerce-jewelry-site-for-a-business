import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getJewelryItemById } from "../api/jewelry";
import Header from "../components/Header";

export default function JewelryItemPage() {
    const { id } = useParams<{ id: string }>();
    const [item, setItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ---- Palette & UI Config (inspired by jewelry glazes/metals) ----
    const BRAND = "#6B8C8E";   // verdigris / muted teal
    const TRANSITION_MS = 400;  // quick fade
    const MEDIA_H = 520;        // fixed stage height (px) -> no card resizing

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

    if (loading) return <main className="p-4">Loading</main>;
    if (error) return <main className="p-4 text-red-600">{error}</main>;
    if (!item) return <main className="p-4">No item found.</main>;

    // Price formatting (always two decimals, Price: NN.NN USD)
    const formattedPrice = item?.price != null ? Number(item.price).toFixed(2) : null;

    // Shipping formatting
    const shippingVal = item?.shippingPrice ?? null;
    const formattedShipping = shippingVal != null ? Number(shippingVal).toFixed(2) : null;
    const isFreeShipping = formattedShipping === "0.00";

    return (
        <div className="min-h-screen p-8 bg-[#fbfbfa] flex flex-col items-center">
            <Header />
            {/* Title with subtle effect + underline bar */}
            <h1
                className="text-3xl font-extrabold tracking-wide mb-3 text-center w-full"
                style={{ color: BRAND, textShadow: "0 1px 0 rgba(0,0,0,0.05)" }}
            >
                {item.name}
            </h1>
            <div
                className="h-1.5 w-28 rounded-full mb-8"
                style={{ background: `linear-gradient(90deg, ${BRAND}, ${BRAND}80)` }}
            />

            {/* Unified card: gallery + thumbnails + description/price */}
            <div className="bg-white rounded-lg shadow-lg max-w-5xl w-full p-8">
                {/* Top section: two-column layout */}
                <div className="w-full flex flex-row gap-8">
                    {/* Gallery Thumbnails */}
                    <div className="flex flex-col gap-4 items-center">
                        {gallery.map((media, idx) => {
                            const isActive = (pendingIdx ?? currentIdx) === idx;
                            return (
                                <div
                                    key={idx}
                                    className={`relative w-16 h-16 rounded-lg border cursor-pointer transition ring-2 ${isActive ? "ring-[color:var(--brand)]" : "ring-transparent"} bg-white`}
                                    onClick={() => beginFadeTo(idx)}
                                    style={{ ["--brand" as any]: BRAND }}
                                    title={media.alt || `Gallery ${idx + 1}`}
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
                                            {/* Play icon overlay in brand color */}
                                            <svg
                                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                                                width="36"
                                                height="36"
                                                viewBox="0 0 36 36"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <circle cx="18" cy="18" r="18" fill={BRAND} fillOpacity="0.9" />
                                                <polygon points="15,11 26,18 15,25" fill="white" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Main Display */}
                    <div className="flex-1 flex items-center justify-center" style={{ minHeight: MEDIA_H }}>
                        <div
                            className={`w-full transition-opacity ${fadingOut ? "opacity-0" : "opacity-100"}`}
                            style={{
                                height: MEDIA_H,
                                transitionDuration: `${TRANSITION_MS}ms`,
                                transitionTimingFunction: "ease-in-out",
                                background: selectedMedia?.type === "video" ? "#000" : "transparent",
                                borderRadius: 12,
                                overflow: "hidden"
                            }}
                            onTransitionEnd={handleTransitionEnd}
                        >
                            {selectedMedia?.type === "image" ? (
                                <img
                                    src={selectedMedia.url}
                                    alt={selectedMedia.alt}
                                    className="w-full h-full object-contain rounded-lg"
                                    width={1600}
                                    height={MEDIA_H}
                                />
                            ) : selectedMedia ? (
                                <video
                                    src={selectedMedia.url}
                                    controls
                                    autoPlay
                                    muted
                                    className="w-full h-full object-contain rounded-lg"
                                    poster={(selectedMedia as any).poster}
                                />
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Verdigris divider */}
                <hr className="my-8 border-t-2" style={{ borderColor: `${BRAND}4D` }} />

                {/* Description + Price + CTA */}
                <div
                    className="w-full rounded-xl p-6 md:p-7"
                    style={{
                        background: `${BRAND}0F`,
                        borderLeft: `4px solid ${BRAND}`
                    }}
                >
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Description</h2>
                    <p className="text-gray-700 leading-relaxed">
                        {item.description}
                    </p>

                    {formattedPrice && (
                        <div className="mt-6 flex flex-wrap items-center gap-4">
                            {/* Price pill */}
                            <span
                                className="inline-flex items-center rounded-full px-4 py-2 text-lg font-semibold"
                                style={{
                                    background: "#fff",
                                    color: "#111827",
                                    boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.05)"
                                }}
                                title="Price"
                            >
                                <span className="mr-2 opacity-80">Price:</span>
                                <span className="tabular-nums">{formattedPrice}</span>
                                <span className="ml-1 opacity-80">USD</span>
                            </span>

                            {/* Shipping pill */}
                            {formattedShipping && (
                                <span
                                    className="inline-flex items-center rounded-full px-4 py-2 text-lg font-semibold"
                                    style={
                                        isFreeShipping
                                            ? {
                                                background: "#22c55e", // green for free shipping
                                                color: "#ffffff"
                                            }
                                            : {
                                                background: "#fff", // same as Price
                                                color: "#111827",
                                                boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.05)"
                                            }
                                    }
                                    title="Shipping price"
                                >
                                    <span className={isFreeShipping ? "mr-2 opacity-90" : "mr-2 opacity-80"}>
                                        Shipping:
                                    </span>
                                    <span className="tabular-nums">{formattedShipping}</span>
                                    <span className={isFreeShipping ? "ml-1 opacity-90" : "ml-1 opacity-80"}>
                                        USD
                                    </span>
                                </span>
                            )}

                            {/* Add to Cart button */}
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition"
                                style={{ backgroundColor: BRAND, focusRingColor: BRAND }}
                                aria-label="Add to cart"
                                title="Add to cart"
                            >
                                <svg
                                    width="20" height="20" viewBox="0 0 24 24" fill="none"
                                    xmlns="http://www.w3.org/2000/svg" className="mr-2"
                                >
                                    <path d="M6 6h15l-1.5 8.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.5L5 3H2"
                                        stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="9" cy="20" r="1.5" fill="white" />
                                    <circle cx="17" cy="20" r="1.5" fill="white" />
                                </svg>
                                Add to cart
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
