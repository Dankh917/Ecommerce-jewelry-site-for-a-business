import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";

// Banner
import siteBanner from "../assets/siteBanner.avif";

// Review screenshots (PNG)
import r1 from "../assets/r1.png";
import r2 from "../assets/r2.png";
import r3 from "../assets/r3.png";
import r4 from "../assets/r4.png";
import r5 from "../assets/r5.png";
import r6 from "../assets/r6.png";

export default function HomePage() {
    const reviews = [
        { src: r1, alt: "Customer review 1" },
        { src: r2, alt: "Customer review 2" },
        { src: r3, alt: "Customer review 3" },
        { src: r4, alt: "Customer review 4" },
        { src: r5, alt: "Customer review 5" },
        { src: r6, alt: "Customer review 6" },
    ];

    const [index, setIndex] = useState(0);

    const lockAndRestoreScroll = () => {
        const x = window.scrollX;
        const y = window.scrollY;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                window.scrollTo(x, y);
            });
        });
    };

    const next = () => {
        setIndex((i) => (i + 1) % reviews.length);
        lockAndRestoreScroll();
    };
    const prev = () => {
        setIndex((i) => (i - 1 + reviews.length) % reviews.length);
        lockAndRestoreScroll();
    };

    // Keyboard navigation
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            const typing =
                !!t &&
                (t.tagName === "INPUT" ||
                    t.tagName === "TEXTAREA" ||
                    (t as HTMLElement).isContentEditable);
            if (typing) return;

            if (e.key === "ArrowRight") {
                e.preventDefault();
                next();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                prev();
            }
        };
        window.addEventListener("keydown", onKey, { passive: false });
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen bg-[#f3f6f7]">
            <Header />

            {/* Banner – no shadow */}
            <div className="w-full mt-3 px-3">
                <img
                    src={siteBanner}
                    alt="EDTArt shop banner"
                    className="block w-full h-auto rounded-3xl"
                />
            </div>

            {/* Gradient background from light bluish white → brand blue */}
            <div className="bg-gradient-to-b from-[#f3f6f7] to-[#6B8C8E]">
                <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
                    {/* Headline + CTA */}
                    <div className="pt-10 text-center">
                        <h1 className="text-4xl md:text-6xl font-extrabold text-gray-800 tracking-tight">
                            EDTArt – Jewish, Bold, Courageous
                        </h1>

                        <div className="mt-6">
                            <Link
                                to="/catalog"
                                className="inline-block px-7 py-3.5 text-lg font-bold text-white bg-[#6B8C8E] rounded-full transition hover:bg-[#567274] active:scale-[0.99]"
                            >
                                Take a look at our catalog
                            </Link>
                        </div>
                    </div>

                    {/* Reviews */}
                    <section className="mt-24 md:mt-28">
                        <div className="mx-auto max-w-[1280px] rounded-2xl bg-white/70 shadow-md [overflow-anchor:none]">
                            <div className="px-6 sm:px-10 py-8 sm:py-10">
                                <h2 className="text-center text-2xl md:text-3xl font-extrabold text-gray-800">
                                    Some of our customer reviews
                                </h2>

                                <div className="mt-6 sm:mt-8 relative mx-auto w-full">
                                    <div className="relative overflow-hidden rounded-2xl bg-white flex items-center justify-center h-[320px] md:h-[400px] [overflow-anchor:none]">
                                        <FadeInFromBottom key={reviews[index].src}>
                                            <img
                                                src={reviews[index].src}
                                                alt={reviews[index].alt}
                                                className="block h-full w-auto object-contain"
                                            />
                                        </FadeInFromBottom>

                                        {/* Nav arrows */}
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                prev();
                                            }}
                                            aria-label="Previous review"
                                            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 hover:bg-white p-2 transition focus:outline-none focus:ring-2 focus:ring-black/30"
                                        >
                                            <ChevronLeft className="h-5 w-5 text-gray-700" />
                                        </button>

                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                next();
                                            }}
                                            aria-label="Next review"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 hover:bg-white p-2 transition focus:outline-none focus:ring-2 focus:ring-black/30"
                                        >
                                            <ChevronRight className="h-5 w-5 text-gray-700" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="h-14" />
                </div>
            </div>
        </div>
    );
}

/** Fade-in from bottom */
function FadeInFromBottom({ children }: { children: React.ReactNode }) {
    const [show, setShow] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setShow(true), 20);
        return () => clearTimeout(t);
    }, []);
    return (
        <div
            className={
                "transition-all duration-500 ease-out will-change-transform will-change-opacity " +
                (show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")
            }
        >
            {children}
        </div>
    );
}

/** Arrows */
function ChevronLeft({ className = "" }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M15 18l-6-6 6-6" />
        </svg>
    );
}
function ChevronRight({ className = "" }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M9 18l6-6-6-6" />
        </svg>
    );
}
