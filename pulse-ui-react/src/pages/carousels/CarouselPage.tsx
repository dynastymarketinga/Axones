import {FullCarousel} from "./FullCarousel"
import {ProductCarousel} from "./ProductCarousel"

export default function CarouselPage () {
    return (
        <div className="carousel-demo-page mx-auto space-y-6">
            <FullCarousel/> 
            
            <div className="p-14 border rounded-xl">
                 <ProductCarousel/>
            </div>
        </div>
    )
}