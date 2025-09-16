export interface JewelryItemGalleryImage {
    url: string;
}

export interface JewelryItemDetails {
    id?: number;
    name: string;
    mainImageUrl: string;
    galleryImages?: JewelryItemGalleryImage[];
    videoUrl?: string;
    videoPosterUrl?: string;
    description: string;
    price?: number;
    shippingPrice?: number;
}
