"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, Search, Home, X, Minus, Plus, Package, Clock, CheckCircle, Loader2, User } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

interface Product {
  id: string
  name: string
  sku: string
  category: string
  price: number
  quantity: number
  description?: string
}

interface CartItem {
  product: Product
  quantity: number
}

interface Order {
  id: string
  orderNo: string
  totalAmount: number
  status: string
  createdAt: string
  items: Array<{
    productName: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
  claimedByUser?: {
    name: string
  }
}

interface Settings {
  pharmacyName: string
  location: string
  contact: string
}

export default function CustomerShopPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [settings, setSettings] = useState<Settings | null>(null)
  const [showCart, setShowCart] = useState(false)
  const [showOrders, setShowOrders] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [notes, setNotes] = useState("")
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const customerId = localStorage.getItem("customerId")
    if (!customerId) {
      router.push("/customer/login")
      return
    }
    fetchProducts()
    fetchSettings()
    fetchOrders()
    // Load cart from localStorage
    const savedCart = localStorage.getItem("customerCart")
    if (savedCart) {
      setCart(JSON.parse(savedCart))
    }
  }, [])

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("customerCart", JSON.stringify(cart))
  }, [cart])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/public/settings")
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/customer/products")
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch products",
      })
    }
  }

  const fetchOrders = async () => {
    try {
      const customerId = localStorage.getItem("customerId")
      const response = await fetch("/api/customer/orders", {
        headers: {
          "x-customer-id": customerId || "",
        },
      })
      if (response.ok) {
        const data = await response.json()
        setOrders(data)
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error)
    }
  }

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.product.id === product.id)
    
    if (existingItem) {
      if (existingItem.quantity >= product.quantity) {
        toast({
          variant: "destructive",
          title: "Cannot add more",
          description: `Only ${product.quantity} available in stock`,
        })
        return
      }
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      )
    } else {
      setCart([...cart, { product, quantity: 1 }])
    }
    
    toast({
      title: "Added to cart",
      description: `${product.name} added successfully`,
    })
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId))
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.product.id !== productId) return item
          const newQty = item.quantity + delta
          if (newQty <= 0) return null
          if (newQty > item.product.quantity) {
            toast({
              variant: "destructive",
              title: "Cannot add more",
              description: `Only ${item.product.quantity} available`,
            })
            return item
          }
          return { ...item, quantity: newQty }
        })
        .filter(Boolean) as CartItem[]
    )
  }

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      toast({
        variant: "destructive",
        title: "Cart is empty",
        description: "Add items to your cart before placing an order",
      })
      return
    }

    setIsSubmitting(true)
    const customerId = localStorage.getItem("customerId")

    try {
      const response = await fetch("/api/customer/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-customer-id": customerId || "",
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          deliveryAddress,
          notes,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Order Placed Successfully!",
          description: `Your order #${data.order.orderNo} has been submitted.`,
        })
        setCart([])
        localStorage.removeItem("customerCart")
        setShowCheckout(false)
        setShowCart(false)
        setDeliveryAddress("")
        setNotes("")
        fetchOrders()
        setShowOrders(true)
      } else {
        const errorData = await response.json()
        toast({
          variant: "destructive",
          title: "Failed to place order",
          description: errorData.error || "Please try again",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to place order. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  )

  const getStatusBadge = (status: string) => {
    const styles: { [key: string]: string } = {
      PENDING: "bg-yellow-100 text-yellow-700",
      PROCESSING: "bg-blue-100 text-blue-700",
      READY: "bg-green-100 text-green-700",
      COMPLETED: "bg-gray-100 text-gray-700",
      CANCELLED: "bg-red-100 text-red-700",
    }
    return styles[status] || "bg-gray-100 text-gray-700"
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white bg-gradient-to-r from-[#F97316]/10 to-[#E8B84B]/10 border-b border-[#F97316]/30 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center space-x-3">
              <div className="relative w-10 h-10">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  fill
                  className="object-contain rounded-lg"
                />
              </div>
              <span className="text-xl font-bold hidden sm:block">
                {settings?.pharmacyName || "SYNAPSE Pharm"}
              </span>
            </Link>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <Home className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Home</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOrders(true)}
              >
                <Package className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">My Orders</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCart(true)}
                className="relative"
              >
                <ShoppingCart className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cart</span>
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void fetch("/api/customer/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "logout" }),
                  }).catch(() => undefined)
                  localStorage.removeItem("customerId")
                  localStorage.removeItem("customerCart")
                  router.push("/customer/login")
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <p className="text-sm text-gray-500">{product.category}</p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {product.description || "No description available"}
                </p>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(product.price)}
                    </span>
                    <p className="text-xs text-gray-500">
                      {product.quantity} in stock
                    </p>
                  </div>
                  <Button
                    onClick={() => addToCart(product)}
                    disabled={product.quantity === 0}
                    size="sm"
                  >
                    {product.quantity === 0 ? "Out of Stock" : "Add to Cart"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No products found</p>
          </div>
        )}
      </main>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowCart(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Shopping Cart</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowCart(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">Your cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <h3 className="font-medium">{item.product.name}</h3>
                          <p className="text-sm text-gray-500">
                            {formatCurrency(item.product.price)} each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.product.id, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.product.id, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t p-4 space-y-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      setShowCart(false)
                      setShowCheckout(true)
                    }}
                  >
                    Proceed to Checkout
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowCheckout(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Confirm Your Order</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCheckout(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Order Summary</h3>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex justify-between text-sm"
                      >
                        <span>
                          {item.product.name} Ã— {item.quantity}
                        </span>
                        <span>
                          {formatCurrency(item.product.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t mt-3 pt-3 flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="address">Delivery Address (Optional)</Label>
                    <Input
                      id="address"
                      placeholder="Enter delivery address..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Input
                      id="notes"
                      placeholder="Any special instructions..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700">
                  <p className="font-medium mb-1">What happens next?</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-600">
                    <li>Our team will be notified of your order</li>
                    <li>A staff member will claim and process your order</li>
                    <li>You&apos;ll receive updates on your order status</li>
                    <li>Payment will be collected upon pickup/delivery</li>
                  </ul>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePlaceOrder}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    "Place Order"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders Modal */}
      {showOrders && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowOrders(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">My Orders</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowOrders(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {orders.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <Card key={order.id}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base">
                                {order.orderNo}
                              </CardTitle>
                              <p className="text-sm text-gray-500">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                                order.status
                              )}`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between text-gray-600"
                              >
                                <span>
                                  {item.productName} Ã— {item.quantity}
                                </span>
                                <span>{formatCurrency(item.totalPrice)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t mt-3 pt-3 flex justify-between font-semibold">
                            <span>Total</span>
                            <span>{formatCurrency(order.totalAmount)}</span>
                          </div>
                          {order.claimedByUser && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                              <User className="h-4 w-4" />
                              <span>
                                Being handled by {order.claimedByUser.name}
                              </span>
                            </div>
                          )}
                          {order.status === "PENDING" && !order.claimedByUser && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                              <Clock className="h-4 w-4" />
                              <span>Waiting for staff to claim</span>
                            </div>
                          )}
                          {order.status === "READY" && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-2 rounded">
                              <CheckCircle className="h-4 w-4" />
                              <span>Ready for pickup!</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t p-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    fetchOrders()
                    toast({
                      title: "Refreshed",
                      description: "Orders updated",
                    })
                  }}
                >
                  Refresh Orders
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

