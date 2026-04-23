import { Card, CardContent } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

export function FullCarousel() {
  return (
    <div className="p-14 border rounded-xl">
      <Carousel className="w-full mx-auto">
        <CarouselContent>
          {[
            "/axones/images/carousels/01.png",
            "/axones/images/carousels/02.png",
            "/axones/images/carousels/03.png",
            "/axones/images/carousels/04.png",
            "/axones/images/carousels/06.png",
          ].map((src, index) => (
            <CarouselItem key={index}>
              <div className="p-1">
                <Card className="overflow-hidden rounded-xl">
                  <CardContent className="p-0">
                    <img
                      src={src}
                      alt={`Slide ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </CardContent>
                </Card>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}
