import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { ShoppingCart } from "lucide-react"

export function ProductCarousel() {
  const products = [
    { title: "Wireless Headphones", price: 89, img: "/axones/products/01.png" },
    { title: "Smart Watch", price: 120, img: "/axones/products/02.png" },
    { title: "Running Shoes", price: 150, img: "/axones/products/03.png" },
    { title: "Leather Bag", price: 65, img: "/axones/products/04.png" },
    { title: "Gaming Mouse", price: 45, img: "/axones/products/05.png" },
    { title: "Bluetooth Speaker", price: 75, img: "/axones/products/06.png" },
  ]

  return (
    <div className="w-full overflow-hidden">
      <Carousel className="w-full overflow-hidden">

            <CarouselContent className="-mx-4">
                {products.map((product, index) => (
                    <CarouselItem
                        key={index}
                        className="pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
                    >
              <Card className="overflow-hidden rounded-2xl hover:shadow-lg transition">
                <CardContent className="p-4 space-y-3">
                  <div className="flex h-40 items-center justify-center bg-muted rounded-xl">
                    <img
                      src={product.img}
                      alt={product.title}
                      className="max-h-full object-contain"
                    />
                  </div>

                  <div>
                    <h6 className="text-base font-semibold">
                      {product.title}
                    </h6>
                    <p className="text-sm text-muted-foreground">
                      ${product.price}
                    </p>
                  </div>

                  <Button className="w-full">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Add to Cart
                  </Button>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* 👇 Bottom Center Navigation */}
        <div className="mt-6 flex justify-center gap-4">
          <CarouselPrevious className="static translate-y-0" />
          <CarouselNext className="static translate-y-0" />
        </div>

      </Carousel>
    </div>
  )
}
