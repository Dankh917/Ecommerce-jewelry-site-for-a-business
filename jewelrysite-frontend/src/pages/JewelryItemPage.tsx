import { useParams } from "react-router-dom";
import { useEffect, useState, type CSSProperties } from "react";
import { getJewelryItemById } from "../api/jewelry";
import Header from "../components/Header";

interface GalleryImage { url: string }
interface JewelryItem {
    name: string;
    mainImageUrl: string;
    galleryImages?: GalleryImage[];
    videoUrl?: string;
    videoPosterUrl?: string;
    description: string;
    price?: number;
    shippingPrice?: number;
}

type Media =
    | { type: "image"; url: string; alt: string }
    | { type: "video"; url: string; alt: string; poster?: string };

export default function JewelryItemPage() {
    const { id } = useParams<{ id: string }>();
    const [item, setItem] = useState<JewelryItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Brand/UI
    const BRAND = "#6B8C8E";       // verdigris you chose
    const MEDIA_H = 520;

    // Gallery state
    const [currentIdx, setCurrentIdx] = useState(0);

    useEffect(() => {
        (async () => {
            try {
                const data = await getJewelryItemById(Number(id));
                setItem(data);
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : "Failed to load item";
                setError(message);
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    // Build gallery once item loads
    const gallery: Media[] = item
        ? [
            { type: "image", url: item.mainImageUrl, alt: item.name },
            ...(item.galleryImages ?? [])
                .filter(img => img.url && img.url !== item.mainImageUrl)
                .map(img => ({ type: "image", url: img.url, alt: item.name })),
            ...(item.videoUrl
                ? [{ type: "video", url: item.videoUrl, alt: "Video", poster: item.videoPosterUrl }]
                : []),
        ]
        : [];

    const selected = gallery[currentIdx];

    const formattedPrice =
        item?.price !== undefined && item?.price !== null
            ? item.price.toFixed(2)
            : null;

    const formattedShipping =
        item?.shippingPrice !== undefined && item?.shippingPrice !== null
            ? item.shippingPrice.toFixed(2)
            : null;

    const isFreeShipping =
        item?.shippingPrice !== undefined && item?.shippingPrice !== null
            ? item.shippingPrice <= 0
            : false;

    if (loading) {
        return (
            <>
                <Header />
                <main className="p-6">Loading…</main>
            </>
        );
    }

    if (error || !item) {
        return (
            <>
                <Header />
                <main className="p-6 text-red-600">
                    {error ?? "Item not found"}
                </main>
            </>
        );
    }

    return (
        <>
            <Header />
            <main className="min-h-screen bg-[#fbfbfa] flex flex-col items-center">
                <div className="p-8 flex flex-col items-center w-full">
                    {/* Title + underline */}
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

                    {/* Card */}
                    <div
                        className="bg-white rounded-lg shadow-lg max-w-5xl w-full p-8"
                        style={{ "--brand": BRAND } as CSSProperties}
                    >
                        {/* Top section: thumbnails + main media */}
                        <div className="w-full flex flex-row gap-8">
                            {/* Thumbnails */}
                            <div className="flex flex-col gap-4 items-center">
                                {gallery.map((media, idx) => {
                                    const isActive = currentIdx === idx;
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setCurrentIdx(idx)}
                                            className={`relative w-16 h-16 rounded-lg border cursor-pointer transition ring-2 ${isActive ? "ring-[var(--brand)]" : "ring-transparent"
                                                } bg-white overflow-hidden`}
                                            style={{ ["--brand" as any]: BRAND }}
                                            title={media.alt || `Gallery ${idx + 1}`}
                                        >
                                            {media.type === "image" ? (
                                                <img
                                                    src={media.url}
                                                    alt={media.alt || `Gallery ${idx + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-black flex items-center justify-center">
                                                    {media.poster ? (
                                                        <img
                                                            src={media.poster}
                                                            alt="Video thumbnail"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : null}
                                                    {/* Play icon overlay */}
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
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Main display */}
                            <div className="flex-1 flex items-center justify-center" style={{ minHeight: MEDIA_H }}>
                                <div
                                    className="w-full rounded-xl overflow-hidden"
                                    style={{
                                        height: MEDIA_H,
                                        background: selected?.type === "video" ? "#000" : "transparent",
                                    }}
                                >
                                    {selected?.type === "image" ? (
                                        <img
                                            src={selected.url}
                                            alt={selected.alt}
                                            className="w-full h-full object-contain"
                                            width={1600}
                                            height={MEDIA_H}
                                        />
                                    ) : selected ? (
                                        <video
                                            src={selected.url}
                                            poster={selected.poster}
                                            controls
                                            className="w-full h-full object-contain"
                                        />
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <hr className="my-8 border-t-2" style={{ borderColor: `${BRAND}4D` }} />

                        {/* Description + Price + CTA */}
                        <div
                            className="w-full rounded-xl p-6 md:p-7"
                            style={{ background: `${BRAND}0F`, borderLeft: `4px solid ${BRAND}` }}
                        >
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Description</h2>
                            <p className="text-gray-700 leading-relaxed">{item.description}</p>

                            {(formattedPrice || formattedShipping) && (
                                <div className="mt-6 flex flex-wrap items-center gap-4">
                                    {/* Price pill */}
                                    {formattedPrice && (
                                        <span
                                            className="inline-flex items-center rounded-full px-4 py-2 text-lg font-semibold"
                                            style={{
                                                background: "#fff",
                                                color: "#111827",
                                                boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.05)",
                                            }}
                                            title="Price"
                                        >
                                            <span className="mr-2 opacity-80">Price:</span>
                                            <span className="tabular-nums">{formattedPrice}</span>
                                            <span className="ml-1 opacity-80">USD</span>
                                        </span>
                                    )}

                                    {/* Shipping pill */}
                                    {formattedShipping && (
                                        <span
                                            className="inline-flex items-center rounded-full px-4 py-2 text-lg font-semibold"
                                            style={
                                                isFreeShipping
                                                    ? { background: "#22c55e", color: "#ffffff" }
                                                    : {
                                                        background: "#fff",
                                                        color: "#111827",
                                                        boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.05)",
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

                                    {/* Add to Cart */}
                                    <button
                                        type="button"
                                        className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition"
                                        style={{ backgroundColor: BRAND }}
                                        aria-label="Add to cart"
                                        title="Add to cart"
                                    >
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="mr-2"
                                        >
                                            <path
                                                d="M6 6h15l-1.5 8.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.5L5 3H2"
                                                stroke="white"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
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
            </main>
        </>
    );
}
