"use client"

import { useEffect, useState, useMemo } from "react"
import { usePharmacySession } from "@/hooks/use-pharmacy-session"

// Debounce hook for better INP performance
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Plus, Upload, Search, Edit, AlertTriangle, Package, PackagePlus, X, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { resilientFetch } from "@/lib/api"

interface ProductPackage {
  id?: string
  name: string
  unitsPerPackage: number
  price: number
  isDefault?: boolean
}

interface ProductBatch {
  id?: string
  batchNumber: string
  quantity: number
  expiryDate: string
  costPrice: number
}

interface Supplier {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  sku: string
  barcode?: string
  category: string
  price: number  // Selling price per basic unit
  costPrice: number  // Cost per basic unit
  quantity: number  // Total quantity in basic units
  initialStock?: number
  reorderLevel: number
  unitOfMeasure: string  // Basic unit type: "Tablet", "Capsule", "ml", etc.
  strength?: string
  dosageForm?: string
  activeIngredient?: string
  genericName?: string
  requiresPrescription?: boolean
  supplierId?: string
  supplier?: { name: string }
  description?: string
  expiryDate?: string
  batchNumber?: string
  manufacturer?: string
  packages?: ProductPackage[]
  batches?: ProductBatch[]
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showUpdateStock, setShowUpdateStock] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showLowStockAlert, setShowLowStockAlert] = useState(true)
  const [lowStockExpanded, setLowStockExpanded] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const { toast } = useToast()

  // Debounce search for better INP performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Memoized filtered products using debounced search
  const allFilteredProducts = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase()
    if (!query) return products
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
    )
  }, [debouncedSearchQuery, products])

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(allFilteredProducts.length / rowsPerPage)
  }, [allFilteredProducts.length, rowsPerPage])

  // Paginate: show current page items
  const filteredProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage
    const endIndex = startIndex + rowsPerPage
    return allFilteredProducts.slice(startIndex, endIndex)
  }, [allFilteredProducts, currentPage, rowsPerPage])

  // Reset to page 1 when search changes or rows per page changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchQuery, rowsPerPage])

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const productsResponse = await resilientFetch("/api/admin/inventory")
      const productsData = await productsResponse.json()
      if (Array.isArray(productsData)) {
        setProducts(productsData)
      } else {
        setProducts([])
      }

      const suppliersResponse = await resilientFetch("/api/admin/suppliers")
      const suppliersData = await suppliersResponse.json()
      if (Array.isArray(suppliersData)) {
        setSuppliers(suppliersData)
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch products",
      })
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }

  // Low stock: if current stock is <= half of initial stock or <= reorderLevel
  const isLowStock = (product: Product) => {
    const initialStock = product.initialStock || product.reorderLevel * 2
    return product.quantity <= Math.max(initialStock / 2, product.reorderLevel)
  }

  const lowStockProducts = products.filter((p) => p.quantity > 0 && isLowStock(p))

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Manage your pharmacy stock and products</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setShowUpdateStock(true)} className="flex-1 sm:flex-none text-xs sm:text-sm px-2 sm:px-4">
            <PackagePlus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Update Stock</span>
            <span className="sm:hidden">Adjust</span>
          </Button>
          <Button variant="outline" onClick={() => setShowBulkUpload(true)} className="flex-1 sm:flex-none text-xs sm:text-sm px-2 sm:px-4">
            <Upload className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Bulk Upload</span>
            <span className="sm:hidden">Bulk</span>
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="flex-1 sm:flex-none text-xs sm:text-sm px-2 sm:px-4">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {lowStockProducts.length > 0 && showLowStockAlert && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle
                className="flex items-center text-orange-800 cursor-pointer hover:text-orange-900"
                onClick={() => setLowStockExpanded(!lowStockExpanded)}
              >
                <AlertTriangle className="h-5 w-5 mr-2" />
                Low Stock Alert - {lowStockProducts.length} product(s)
                {lowStockExpanded ? (
                  <ChevronUp className="h-4 w-4 ml-2" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-2" />
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLowStockAlert(false)}
                className="text-orange-700 hover:text-orange-900 hover:bg-primary/15"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          {lowStockExpanded && (
            <CardContent className="pt-2">
              <p className="text-sm text-orange-700 mb-3">
                The following products need stock replenishment:
              </p>
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-orange-800">Product</TableHead>
                      <TableHead className="text-orange-800">SKU</TableHead>
                      <TableHead className="text-orange-800">Current Stock</TableHead>
                      <TableHead className="text-orange-800">Reorder Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.map((p) => (
                      <TableRow key={p.id} className="border-orange-200">
                        <TableCell className="text-orange-700 font-medium">{p.name}</TableCell>
                        <TableCell className="text-primary">{p.sku}</TableCell>
                        <TableCell className="text-orange-700 font-semibold">{p.quantity}</TableCell>
                        <TableCell className="text-primary">{p.reorderLevel}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {showEditDialog && selectedProduct && (
        <EditProductDialog
          product={selectedProduct}
          suppliers={suppliers}
          onClose={() => {
            setShowEditDialog(false)
            setSelectedProduct(null)
          }}
          onSuccess={() => {
            setShowEditDialog(false)
            setSelectedProduct(null)
            fetchProducts()
          }}
        />
      )}

      {showUpdateStock && (
        <UpdateStockDialog
          products={products}
          onClose={() => setShowUpdateStock(false)}
          onSuccess={() => {
            setShowUpdateStock(false)
            fetchProducts()
          }}
        />
      )}

      {showCreateDialog && (
        <CreateProductDialog
          onClose={() => setShowCreateDialog(false)}
          suppliers={suppliers}
          onSuccess={() => {
            setShowCreateDialog(false)
            fetchProducts()
          }}
        />
      )}

      {showBulkUpload && (
        <BulkUploadDialog
          onClose={() => setShowBulkUpload(false)}
          onSuccess={() => {
            setShowBulkUpload(false)
            fetchProducts()
          }}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Products</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Showing {filteredProducts.length} of {allFilteredProducts.length} products
                {debouncedSearchQuery && ` (filtered from ${products.length} total)`}
              </p>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                }}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Generic Name</TableHead>
                <TableHead>Strength</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Batch No.</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    <div>{product.name}</div>
                    {product.dosageForm && <div className="text-xs text-muted-foreground">{product.dosageForm}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{product.genericName || "-"}</TableCell>
                  <TableCell className="text-sm">{product.strength || "-"}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell className="text-sm">{product.supplier?.name || "-"}</TableCell>
                  <TableCell>{product.unitOfMeasure}</TableCell>
                  <TableCell className="text-sm">{product.batchNumber || "-"}</TableCell>
                  <TableCell className="text-sm">
                    {product.expiryDate ? (
                      <span className={new Date(product.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) ? "text-primary font-semibold" : ""}>
                        {new Date(product.expiryDate).toLocaleDateString()}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>{formatCurrency(product.price)}</TableCell>
                  <TableCell>
                    <span className={product.quantity <= product.reorderLevel ? "text-primary font-semibold" : ""}>
                      {product.quantity}
                    </span>
                  </TableCell>
                  <TableCell>
                    {product.quantity === 0 ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-500/15 text-destructive">
                        Out of Stock
                      </span>
                    ) : isLowStock(product) ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/15 text-orange-700">
                        Low Stock - Replenish
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-500/15 text-[#22C55E]">
                        In Stock
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedProduct(product)
                        setShowEditDialog(true)
                      }}
                      title="Edit Product"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t gap-4">
            {/* Rows per page selector */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <label htmlFor="rowsPerPage">Rows per page:</label>
              <select
                id="rowsPerPage"
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="border rounded px-2 py-1 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Rows per page"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Page info and navigation */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages || 1}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3"
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="px-3"
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="px-2"
                >
                  Last
                </Button>
              </div>
            </div>

            {/* Total items info */}
            <div className="text-sm text-muted-foreground">
              {allFilteredProducts.length} total items
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface CreateProductDialogProps {
  onClose: () => void
  onSuccess: () => void
}

function generateSku(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase())
    .join("-")
}

function CreateProductDialog({ onClose, onSuccess, suppliers }: CreateProductDialogProps & { suppliers: Supplier[] }) {
  // Section 1: Basic Product Info
  const [skuEdited, setSkuEdited] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    costPrice: "",  // Cost per basic unit
    price: "",      // Selling price per basic unit
    quantity: "",   // Total in basic units
    reorderLevel: "10",
    unitOfMeasure: "Tablet",  // Basic unit type
    barcode: "",
    description: "",
    manufacturer: "",
    strength: "",
    dosageForm: "",
    activeIngredient: "",
    requiresPrescription: false,
    supplierId: "",
    genericName: "",
    sideEffects: "",
    storageInstructions: "",
    regulatoryId: "",
  })

  // Section 2: Package Definitions
  const [packages, setPackages] = useState<{ name: string; unitsPerPackage: string; price: string }[]>([])
  const [newPackage, setNewPackage] = useState({ name: "", unitsPerPackage: "", price: "" })

  // Section 3: Batch/Stock Tracking
  const [batches, setBatches] = useState<{ batchNumber: string; quantity: string; expiryDate: string; costPrice: string }[]>([])
  const [newBatch, setNewBatch] = useState({ batchNumber: "", quantity: "", expiryDate: "", costPrice: "" })

  // Section visibility
  const [showPackages, setShowPackages] = useState(false)
  const [showBatches, setShowBatches] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Auto-calculate package price when selling price or units change
  const calculatePackagePrice = (unitsPerPackage: string): string => {
    const units = parseFloat(unitsPerPackage) || 0
    const pricePerUnit = parseFloat(formData.price) || 0
    return (units * pricePerUnit).toString()
  }

  // Add package to list
  const addPackage = () => {
    if (!newPackage.name || !newPackage.unitsPerPackage) {
      toast({ variant: "destructive", title: "Error", description: "Package name and units required" })
      return
    }
    const calculatedPrice = newPackage.price || calculatePackagePrice(newPackage.unitsPerPackage)
    setPackages([...packages, { ...newPackage, price: calculatedPrice }])
    setNewPackage({ name: "", unitsPerPackage: "", price: "" })
  }

  // Add batch to list
  const addBatch = () => {
    if (!newBatch.batchNumber || !newBatch.quantity || !newBatch.expiryDate) {
      toast({ variant: "destructive", title: "Error", description: "Batch number, quantity, and expiry required" })
      return
    }
    const batchCost = newBatch.costPrice || formData.costPrice
    setBatches([...batches, { ...newBatch, costPrice: batchCost }])
    setNewBatch({ batchNumber: "", quantity: "", expiryDate: "", costPrice: "" })

    // Update total quantity
    const newTotal = batches.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0) + (parseFloat(newBatch.quantity) || 0)
    setFormData({ ...formData, quantity: newTotal.toString() })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await resilientFetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          costPrice: parseFloat(formData.costPrice),
          quantity: parseInt(formData.quantity) || 0,
          reorderLevel: parseInt(formData.reorderLevel),
          barcode: formData.barcode || null,
          manufacturer: formData.manufacturer || null,
          category: formData.category || "General",
          // Include packages and batches for API to create
          packages: packages.map(p => ({
            name: p.name,
            unitsPerPackage: parseInt(p.unitsPerPackage),
            price: parseFloat(p.price),
          })),
          batches: batches.map(b => ({
            batchNumber: b.batchNumber,
            quantity: parseInt(b.quantity),
            expiryDate: b.expiryDate,
            costPrice: parseFloat(b.costPrice),
          })),
        }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "Product created successfully" })
        onSuccess()
      } else {
        const data = await response.json()
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to create product" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An error occurred" })
    } finally {
      setIsLoading(false)
    }
  }

  const basicUnits = [
    { value: "Tablet", label: "Tablet" },
    { value: "Capsule", label: "Capsule" },
    { value: "ml", label: "ml (Milliliter)" },
    { value: "mg", label: "mg (Milligram)" },
    { value: "Piece", label: "Piece" },
    { value: "Dose", label: "Dose" },
    { value: "Sachet", label: "Sachet" },
    { value: "Ampoule", label: "Ampoule" },
    { value: "Vial", label: "Vial" },
    { value: "Tube", label: "Tube" },
    { value: "Suppository", label: "Suppository" },
    { value: "Drop", label: "Drop" },
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle>Add New Product</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* SECTION 1: Basic Product Info */}
            <div className="border rounded-lg p-4 bg-blue-50/50">
              <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                <Package className="h-4 w-4 mr-2" />
                Section 1: Basic Product Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="strength">Strength</Label>
                  <Input id="strength" value={formData.strength} onChange={(e) => setFormData({ ...formData, strength: e.target.value })} placeholder="e.g., 500mg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dosageForm">Dosage Form</Label>
                  <Input id="dosageForm" value={formData.dosageForm} onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })} placeholder="e.g., Tablet" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activeIngredient">Active Ingredient</Label>
                  <Input id="activeIngredient" value={formData.activeIngredient} onChange={(e) => setFormData({ ...formData, activeIngredient: e.target.value })} placeholder="e.g., Paracetamol" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplierId">Supplier</Label>
                  <select
                    id="supplierId"
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <input
                    type="checkbox"
                    id="requiresPrescription"
                    checked={formData.requiresPrescription}
                    onChange={(e) => setFormData({ ...formData, requiresPrescription: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="requiresPrescription">Requires Prescription</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="genericName">Generic Name</Label>
                  <Input id="genericName" value={formData.genericName} onChange={(e) => setFormData({ ...formData, genericName: e.target.value })} placeholder="e.g., Acetaminophen" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regulatoryId">Regulatory ID</Label>
                  <Input id="regulatoryId" value={formData.regulatoryId} onChange={(e) => setFormData({ ...formData, regulatoryId: e.target.value })} placeholder="e.g., NDA/123/456" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sideEffects">Side Effects</Label>
                  <Input id="sideEffects" value={formData.sideEffects} onChange={(e) => setFormData({ ...formData, sideEffects: e.target.value })} placeholder="e.g., Drowsiness, Nausea" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storageInstructions">Storage Instructions</Label>
                  <Input id="storageInstructions" value={formData.storageInstructions} onChange={(e) => setFormData({ ...formData, storageInstructions: e.target.value })} placeholder="e.g., Store below 25C" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value
                      setFormData((prev) => ({
                        ...prev,
                        name,
                        sku: skuEdited ? prev.sku : generateSku(name),
                      }))
                    }}
                    required
                    placeholder="e.g., Paracetamol 500mg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => { setSkuEdited(true); setFormData({ ...formData, sku: e.target.value }) }}
                    required
                    placeholder="Auto-generated from name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="e.g., Pain Relief (optional)" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitOfMeasure">Basic Unit *</Label>
                  <select id="unitOfMeasure" value={formData.unitOfMeasure} onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                    {basicUnits.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costPrice">Cost per {formData.unitOfMeasure} *</Label>
                  <Input id="costPrice" type="number" step="0.01" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })} required placeholder="e.g., 50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Selling Price per {formData.unitOfMeasure} *</Label>
                  <Input id="price" type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required placeholder="e.g., 100" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Total Quantity ({formData.unitOfMeasure}s) *</Label>
                  <Input id="quantity" type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required placeholder="e.g., 1000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reorderLevel">Reorder Level</Label>
                  <Input id="reorderLevel" type="number" value={formData.reorderLevel} onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input id="barcode" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} placeholder="Scan or enter" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input id="manufacturer" value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} placeholder="e.g., Cipla" />
                </div>
              </div>
              {formData.price && formData.costPrice && (
                <div className="mt-3 p-2 bg-green-500/15 rounded text-sm text-green-800">
                  <strong>Profit per {formData.unitOfMeasure}:</strong> {formatCurrency((parseFloat(formData.price) || 0) - (parseFloat(formData.costPrice) || 0))}
                  ({(((parseFloat(formData.price) || 0) - (parseFloat(formData.costPrice) || 0)) / (parseFloat(formData.costPrice) || 1) * 100).toFixed(1)}% margin)
                </div>
              )}
            </div>

            {/* SECTION 2: Package Definitions */}
            <div className="border rounded-lg overflow-hidden">
              <button type="button" onClick={() => setShowPackages(!showPackages)} className="w-full p-3 bg-purple-50 text-left flex justify-between items-center hover:bg-purple-500/15 transition-colors">
                <span className="text-sm font-semibold text-purple-800 flex items-center">
                  <PackagePlus className="h-4 w-4 mr-2" />
                  Section 2: Package Definitions (Optional)
                </span>
                {showPackages ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showPackages && (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-muted-foreground">Define how the product is packaged for easier sales (e.g., Strip = 10 tablets)</p>

                  {packages.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Package Name</TableHead>
                          <TableHead>Units/Package</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {packages.map((pkg, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{pkg.name}</TableCell>
                            <TableCell>{pkg.unitsPerPackage} {formData.unitOfMeasure}s</TableCell>
                            <TableCell>{formatCurrency(parseFloat(pkg.price))}</TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setPackages(packages.filter((_, i) => i !== idx))}>
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Package Name</Label>
                      <Input placeholder="e.g., Strip" value={newPackage.name} onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })} />
                    </div>
                    <div className="w-28">
                      <Label className="text-xs">Units</Label>
                      <Input type="number" placeholder="10" value={newPackage.unitsPerPackage} onChange={(e) => setNewPackage({ ...newPackage, unitsPerPackage: e.target.value, price: calculatePackagePrice(e.target.value) })} />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs">Price (auto)</Label>
                      <Input type="number" placeholder="Auto" value={newPackage.price || calculatePackagePrice(newPackage.unitsPerPackage)} onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })} />
                    </div>
                    <Button type="button" onClick={addPackage} size="sm"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: Batch/Stock Tracking */}
            <div className="border rounded-lg overflow-hidden">
              <button type="button" onClick={() => setShowBatches(!showBatches)} className="w-full p-3 bg-orange-50 text-left flex justify-between items-center hover:bg-primary/15 transition-colors">
                <span className="text-sm font-semibold text-orange-800 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Section 3: Batch/Stock Tracking (Optional)
                </span>
                {showBatches ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showBatches && (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-muted-foreground">Track stock by batch for expiry management (FIFO: oldest sold first)</p>

                  {batches.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Batch #</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead>Cost</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batches.map((batch, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{batch.batchNumber}</TableCell>
                            <TableCell>{batch.quantity}</TableCell>
                            <TableCell>{new Date(batch.expiryDate).toLocaleDateString()}</TableCell>
                            <TableCell>{formatCurrency(parseFloat(batch.costPrice))}</TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="sm" onClick={() => {
                                const removed = batches[idx]
                                setBatches(batches.filter((_, i) => i !== idx))
                                const newTotal = batches.filter((_, i) => i !== idx).reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0)
                                setFormData({ ...formData, quantity: newTotal.toString() })
                              }}>
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-32">
                      <Label className="text-xs">Batch Number</Label>
                      <Input placeholder="BATCH-001" value={newBatch.batchNumber} onChange={(e) => setNewBatch({ ...newBatch, batchNumber: e.target.value })} />
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Quantity</Label>
                      <Input type="number" placeholder="100" value={newBatch.quantity} onChange={(e) => setNewBatch({ ...newBatch, quantity: e.target.value })} />
                    </div>
                    <div className="w-36">
                      <Label className="text-xs">Expiry Date</Label>
                      <Input type="date" value={newBatch.expiryDate} onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })} />
                    </div>
                    <div className="w-28">
                      <Label className="text-xs">Cost (optional)</Label>
                      <Input type="number" placeholder={formData.costPrice || "Cost"} value={newBatch.costPrice} onChange={(e) => setNewBatch({ ...newBatch, costPrice: e.target.value })} />
                    </div>
                    <Button type="button" onClick={addBatch} size="sm"><Plus className="h-4 w-4" /></Button>
                  </div>

                  {batches.length > 0 && (
                    <div className="p-2 bg-primary/15 rounded text-sm text-orange-800">
                      <strong>Total from batches:</strong> {batches.reduce((sum, b) => sum + (parseInt(b.quantity) || 0), 0)} {formData.unitOfMeasure}s
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>{isLoading ? "Creating..." : "Create Product"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function BulkUploadDialog({ onClose, onSuccess }: CreateProductDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ count?: number; errors?: string[]; skipped?: string[] } | null>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setUploadResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a file",
      })
      return
    }

    setIsLoading(true)
    setUploadResult(null)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await resilientFetch("/api/admin/inventory/bulk-upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setUploadResult({ count: data.count, errors: data.errors, skipped: data.skipped })
        toast({
          title: "Success",
          description: `${data.count} products uploaded successfully`,
        })
        if (!data.errors?.length && !data.skipped?.length) {
          onSuccess()
        }
      } else {
        setUploadResult({ errors: data.details || [data.error], skipped: data.skipped })
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: data.hint || data.error || "Failed to upload products",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred during upload",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent = [
      "name,generic_name,category,dosage_form,strength,unit_of_measure,barcode,sku,price,cost_price,quantity,reorder_level,expiry_date,requires_prescription,manufacturer,supplier",
      "Paracetamol 500mg,Paracetamol,Pain Relief,Strip,500mg,Strip,,PAR500,5000,3000,100,20,2027-12-31,No,Cipla,Cipla Uganda Ltd",
      "Ibuprofen 400mg,Ibuprofen,Pain Relief,Box,400mg,Box,,IBU400,8000,5000,150,25,2026-06-30,No,GSK,GSK Uganda",
    ].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "product-template.csv"
    a.click()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Bulk Upload Products</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Upload a <strong>CSV or Excel</strong> file with product details</li>
              <li>Supports Tally exports and other formats</li>
              <li>Auto-detects columns: Name/Item Name, Price/Rate/MRP, Qty/Stock, etc.</li>
              <li>SKU will be auto-generated if not provided</li>
            </ul>
          </div>

          <div className="bg-muted/20 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground font-medium mb-1">Supported column names:</p>
            <p className="text-xs text-muted-foreground">
              <strong>Name:</strong> Name, Item Name, Stock Item, Product Name<br />
              <strong>Price:</strong> Price, Rate, MRP, Selling Price<br />
              <strong>Cost:</strong> Cost Price, Purchase Price, Cost<br />
              <strong>Quantity:</strong> Quantity, Qty, Stock, Closing Stock<br />
              <strong>Category:</strong> Category, Group, Under
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={downloadTemplate}
            className="w-full"
          >
            <Package className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>

          <div className="space-y-2">
            <Label htmlFor="file">Select File (CSV or Excel)</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={isLoading}
            />
            {file && (
              <p className="text-sm text-muted-foreground">Selected: {file.name}</p>
            )}
          </div>

          {uploadResult && (
            <div className={`rounded-lg p-3 ${uploadResult.count ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {uploadResult.count && (
                <p className="text-[#22C55E] font-semibold">✓ {uploadResult.count} products uploaded successfully</p>
              )}
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-destructive font-semibold text-sm">Errors ({uploadResult.errors.length}):</p>
                  <ul className="text-xs text-destructive max-h-24 overflow-y-auto">
                    {uploadResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {uploadResult.errors.length > 5 && (
                      <li>...and {uploadResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              {uploadResult.skipped && uploadResult.skipped.length > 0 && (
                <div className="mt-2">
                  <p className="text-yellow-400 font-semibold text-sm">Skipped ({uploadResult.skipped.length}):</p>
                  <ul className="text-xs text-yellow-400 max-h-24 overflow-y-auto">
                    {uploadResult.skipped.slice(0, 3).map((skip, i) => (
                      <li key={i}>• {skip}</li>
                    ))}
                    {uploadResult.skipped.length > 3 && (
                      <li>...and {uploadResult.skipped.length - 3} more duplicates</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {uploadResult?.count ? "Done" : "Cancel"}
            </Button>
            <Button onClick={handleUpload} disabled={isLoading || !file}>
              {isLoading ? "Uploading..." : "Upload Products"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface EditProductDialogProps {
  product: Product
  onClose: () => void
  onSuccess: () => void
}

function EditProductDialog({ product, onClose, onSuccess, suppliers }: EditProductDialogProps & { suppliers: Supplier[] }) {
  // Section 1: Basic Product Info
  const [formData, setFormData] = useState({
    name: product.name,
    sku: product.sku,
    barcode: product.barcode || "",
    category: product.category || "",
    costPrice: product.costPrice?.toString() || "0",
    price: product.price.toString(),
    quantity: product.quantity.toString(),
    reorderLevel: product.reorderLevel?.toString() || "10",
    unitOfMeasure: product.unitOfMeasure || "Tablet",
    description: product.description || "",
    manufacturer: product.manufacturer || "",
    strength: product.strength || "",
    dosageForm: product.dosageForm || "",
    activeIngredient: product.activeIngredient || "",
    requiresPrescription: product.requiresPrescription || false,
    supplierId: product.supplierId || "",
    genericName: (product as any).genericName || "",
    sideEffects: (product as any).sideEffects || "",
    storageInstructions: (product as any).storageInstructions || "",
    regulatoryId: (product as any).regulatoryId || "",
  })

  // Section 2: Package Definitions (load from product)
  const [packages, setPackages] = useState<{ id?: string; name: string; unitsPerPackage: string; price: string }[]>(
    product.packages?.map(p => ({
      id: p.id,
      name: p.name,
      unitsPerPackage: p.unitsPerPackage.toString(),
      price: p.price.toString(),
    })) || []
  )
  const [newPackage, setNewPackage] = useState({ name: "", unitsPerPackage: "", price: "" })
  const [deletedPackageIds, setDeletedPackageIds] = useState<string[]>([])

  // Section 3: Batch/Stock Tracking (load from product)
  const [batches, setBatches] = useState<{ id?: string; batchNumber: string; quantity: string; expiryDate: string; costPrice: string }[]>(
    product.batches?.map(b => ({
      id: b.id,
      batchNumber: b.batchNumber,
      quantity: b.quantity.toString(),
      expiryDate: b.expiryDate?.split("T")[0] || "",
      costPrice: b.costPrice.toString(),
    })) || []
  )
  const [newBatch, setNewBatch] = useState({ batchNumber: "", quantity: "", expiryDate: "", costPrice: "" })
  const [deletedBatchIds, setDeletedBatchIds] = useState<string[]>([])

  const [showPackages, setShowPackages] = useState((product.packages?.length || 0) > 0)
  const [showBatches, setShowBatches] = useState((product.batches?.length || 0) > 0)

  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const { user } = usePharmacySession()
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${product.name}?`)) return

    setIsLoading(true)
    try {
      const response = await resilientFetch(`/api/admin/inventory?id=${product.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({ title: "Success", description: "Product deleted successfully" })
        onSuccess()
      } else {
        const data = await response.json()
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to delete product" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An error occurred" })
    } finally {
      setIsLoading(false)
    }
  }

  const calculatePackagePrice = (unitsPerPackage: string): string => {
    const units = parseFloat(unitsPerPackage) || 0
    const pricePerUnit = parseFloat(formData.price) || 0
    return (units * pricePerUnit).toString()
  }

  const addPackage = () => {
    if (!newPackage.name || !newPackage.unitsPerPackage) {
      toast({ variant: "destructive", title: "Error", description: "Package name and units required" })
      return
    }
    const calculatedPrice = newPackage.price || calculatePackagePrice(newPackage.unitsPerPackage)
    setPackages([...packages, { ...newPackage, price: calculatedPrice }])
    setNewPackage({ name: "", unitsPerPackage: "", price: "" })
  }

  const removePackage = (idx: number) => {
    const pkg = packages[idx]
    if (pkg.id) setDeletedPackageIds([...deletedPackageIds, pkg.id])
    setPackages(packages.filter((_, i) => i !== idx))
  }

  const addBatch = () => {
    if (!newBatch.batchNumber || !newBatch.quantity || !newBatch.expiryDate) {
      toast({ variant: "destructive", title: "Error", description: "Batch number, quantity, and expiry required" })
      return
    }
    const batchCost = newBatch.costPrice || formData.costPrice
    setBatches([...batches, { ...newBatch, costPrice: batchCost }])
    setNewBatch({ batchNumber: "", quantity: "", expiryDate: "", costPrice: "" })
  }

  const removeBatch = (idx: number) => {
    const batch = batches[idx]
    if (batch.id) setDeletedBatchIds([...deletedBatchIds, batch.id])
    setBatches(batches.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await resilientFetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          ...formData,
          price: parseFloat(formData.price),
          costPrice: parseFloat(formData.costPrice),
          quantity: parseInt(formData.quantity),
          reorderLevel: parseInt(formData.reorderLevel),
          barcode: formData.barcode || null,
          manufacturer: formData.manufacturer || null,
          category: formData.category || "General",
          packages: packages.map(p => ({
            id: p.id,
            name: p.name,
            unitsPerPackage: parseInt(p.unitsPerPackage),
            price: parseFloat(p.price),
          })),
          batches: batches.map(b => ({
            id: b.id,
            batchNumber: b.batchNumber,
            quantity: parseInt(b.quantity),
            expiryDate: b.expiryDate,
            costPrice: parseFloat(b.costPrice),
          })),
          deletedPackageIds,
          deletedBatchIds,
        }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "Product updated successfully" })
        onSuccess()
      } else {
        const data = await response.json()
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to update product" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An error occurred" })
    } finally {
      setIsLoading(false)
    }
  }

  const basicUnits = [
    { value: "Tablet", label: "Tablet" }, { value: "Capsule", label: "Capsule" },
    { value: "ml", label: "ml (Milliliter)" }, { value: "mg", label: "mg (Milligram)" },
    { value: "Piece", label: "Piece" }, { value: "Dose", label: "Dose" },
    { value: "Sachet", label: "Sachet" }, { value: "Ampoule", label: "Ampoule" },
    { value: "Vial", label: "Vial" }, { value: "Tube", label: "Tube" },
    { value: "Suppository", label: "Suppository" }, { value: "Drop", label: "Drop" },
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle>Edit Product: {product.name}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* SECTION 1: Basic Product Info */}
            <div className="border rounded-lg p-4 bg-blue-50/50">
              <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                <Package className="h-4 w-4 mr-2" />
                Section 1: Basic Product Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-strength">Strength</Label>
                  <Input id="edit-strength" value={formData.strength} onChange={(e) => setFormData({ ...formData, strength: e.target.value })} placeholder="e.g., 500mg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-dosageForm">Dosage Form</Label>
                  <Input id="edit-dosageForm" value={formData.dosageForm} onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })} placeholder="e.g., Tablet" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-activeIngredient">Active Ingredient</Label>
                  <Input id="edit-activeIngredient" value={formData.activeIngredient} onChange={(e) => setFormData({ ...formData, activeIngredient: e.target.value })} placeholder="e.g., Paracetamol" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-supplierId">Supplier</Label>
                  <select
                    id="edit-supplierId"
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <input
                    type="checkbox"
                    id="edit-requiresPrescription"
                    checked={formData.requiresPrescription}
                    onChange={(e) => setFormData({ ...formData, requiresPrescription: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="edit-requiresPrescription">Requires Prescription</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-genericName">Generic Name</Label>
                  <Input id="edit-genericName" value={formData.genericName} onChange={(e) => setFormData({ ...formData, genericName: e.target.value })} placeholder="e.g., Acetaminophen" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-regulatoryId">Regulatory ID</Label>
                  <Input id="edit-regulatoryId" value={formData.regulatoryId} onChange={(e) => setFormData({ ...formData, regulatoryId: e.target.value })} placeholder="e.g., NDA/123/456" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sideEffects">Side Effects</Label>
                  <Input id="edit-sideEffects" value={formData.sideEffects} onChange={(e) => setFormData({ ...formData, sideEffects: e.target.value })} placeholder="e.g., Drowsiness, Nausea" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-storageInstructions">Storage Instructions</Label>
                  <Input id="edit-storageInstructions" value={formData.storageInstructions} onChange={(e) => setFormData({ ...formData, storageInstructions: e.target.value })} placeholder="e.g., Store below 25C" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Product Name *</Label>
                  <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g., Paracetamol 500mg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sku">SKU *</Label>
                  <Input id="edit-sku" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} required placeholder="e.g., PAR-500" disabled className="bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Input id="edit-category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="e.g., Pain Relief (optional)" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-unitOfMeasure">Basic Unit *</Label>
                  <select id="edit-unitOfMeasure" value={formData.unitOfMeasure} onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                    {basicUnits.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-costPrice">Cost per {formData.unitOfMeasure} *</Label>
                  <Input id="edit-costPrice" type="number" step="0.01" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })} required placeholder="e.g., 50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Selling Price per {formData.unitOfMeasure} *</Label>
                  <Input id="edit-price" type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required placeholder="e.g., 100" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-quantity">Total Quantity ({formData.unitOfMeasure}s) *</Label>
                  <Input id="edit-quantity" type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required placeholder="e.g., 1000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-reorderLevel">Reorder Level</Label>
                  <Input id="edit-reorderLevel" type="number" value={formData.reorderLevel} onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-barcode">Barcode</Label>
                  <Input id="edit-barcode" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} placeholder="Scan or enter" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-manufacturer">Manufacturer</Label>
                  <Input id="edit-manufacturer" value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} placeholder="e.g., Cipla" />
                </div>
              </div>
              {formData.price && formData.costPrice && (
                <div className="mt-3 p-2 bg-green-500/15 rounded text-sm text-green-800">
                  <strong>Profit per {formData.unitOfMeasure}:</strong> {formatCurrency((parseFloat(formData.price) || 0) - (parseFloat(formData.costPrice) || 0))}
                  ({(((parseFloat(formData.price) || 0) - (parseFloat(formData.costPrice) || 0)) / (parseFloat(formData.costPrice) || 1) * 100).toFixed(1)}% margin)
                </div>
              )}
            </div>

            {/* SECTION 2: Package Definitions */}
            <div className="border rounded-lg overflow-hidden">
              <button type="button" onClick={() => setShowPackages(!showPackages)} className="w-full p-3 bg-purple-50 text-left flex justify-between items-center hover:bg-purple-500/15">
                <span className="text-sm font-semibold text-purple-800 flex items-center">
                  <PackagePlus className="h-4 w-4 mr-2" />
                  Section 2: Package Definitions ({packages.length})
                </span>
                {showPackages ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showPackages && (
                <div className="p-4 space-y-3">
                  {packages.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Package</TableHead>
                          <TableHead>Units</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {packages.map((pkg, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{pkg.name}</TableCell>
                            <TableCell>{pkg.unitsPerPackage} {formData.unitOfMeasure}s</TableCell>
                            <TableCell>{formatCurrency(parseFloat(pkg.price))}</TableCell>
                            <TableCell><Button type="button" variant="ghost" size="sm" onClick={() => removePackage(idx)}><X className="h-4 w-4 text-destructive" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1"><Label className="text-xs">Package Name</Label><Input placeholder="Strip" value={newPackage.name} onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })} /></div>
                    <div className="w-24"><Label className="text-xs">Units</Label><Input type="number" placeholder="10" value={newPackage.unitsPerPackage} onChange={(e) => setNewPackage({ ...newPackage, unitsPerPackage: e.target.value, price: calculatePackagePrice(e.target.value) })} /></div>
                    <div className="w-28"><Label className="text-xs">Price</Label><Input type="number" value={newPackage.price || calculatePackagePrice(newPackage.unitsPerPackage)} onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })} /></div>
                    <Button type="button" onClick={addPackage} size="sm"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: Batch/Stock Tracking */}
            <div className="border rounded-lg overflow-hidden">
              <button type="button" onClick={() => setShowBatches(!showBatches)} className="w-full p-3 bg-orange-50 text-left flex justify-between items-center hover:bg-primary/15">
                <span className="text-sm font-semibold text-orange-800 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Section 3: Batch/Stock ({batches.length} batches)
                </span>
                {showBatches ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showBatches && (
                <div className="p-4 space-y-3">
                  {batches.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Batch #</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead>Cost</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batches.map((batch, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{batch.batchNumber}</TableCell>
                            <TableCell>{batch.quantity}</TableCell>
                            <TableCell>{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '-'}</TableCell>
                            <TableCell>{formatCurrency(parseFloat(batch.costPrice))}</TableCell>
                            <TableCell><Button type="button" variant="ghost" size="sm" onClick={() => removeBatch(idx)}><X className="h-4 w-4 text-destructive" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-28"><Label className="text-xs">Batch #</Label><Input placeholder="BATCH-001" value={newBatch.batchNumber} onChange={(e) => setNewBatch({ ...newBatch, batchNumber: e.target.value })} /></div>
                    <div className="w-20"><Label className="text-xs">Qty</Label><Input type="number" placeholder="100" value={newBatch.quantity} onChange={(e) => setNewBatch({ ...newBatch, quantity: e.target.value })} /></div>
                    <div className="w-32"><Label className="text-xs">Expiry</Label><Input type="date" value={newBatch.expiryDate} onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })} /></div>
                    <div className="w-24"><Label className="text-xs">Cost</Label><Input type="number" placeholder={formData.costPrice} value={newBatch.costPrice} onChange={(e) => setNewBatch({ ...newBatch, costPrice: e.target.value })} /></div>
                    <Button type="button" onClick={addBatch} size="sm"><Plus className="h-4 w-4" /></Button>
                  </div>
                  {batches.length > 0 && (
                    <div className="p-2 bg-primary/15 rounded text-sm text-orange-800">
                      <strong>Total from batches:</strong> {batches.reduce((sum, b) => sum + (parseInt(b.quantity) || 0), 0)} {formData.unitOfMeasure}s
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              {(user?.pharmacyRole === "pharmacy_admin" || user?.pharmacyRole === "pharmacy_ceo") && (
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={isLoading} className="mr-auto">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Product
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save Changes"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

interface UpdateStockDialogProps {
  products: Product[]
  onClose: () => void
  onSuccess: () => void
}

function UpdateStockDialog({ products, onClose, onSuccess }: UpdateStockDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [unitsToAdd, setUnitsToAdd] = useState("")
  const [batchNumber, setBatchNumber] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // When product is selected, populate existing batch/expiry
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product)
    setBatchNumber(product.batchNumber || "")
    setExpiryDate(product.expiryDate ? product.expiryDate.split("T")[0] : "")
  }

  const handleUpdateStock = async () => {
    if (!selectedProduct || !unitsToAdd) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a product and enter quantity to add",
      })
      return
    }

    const addQuantity = parseInt(unitsToAdd)
    if (isNaN(addQuantity) || addQuantity <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid positive number",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await resilientFetch("/api/admin/inventory/stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: addQuantity,
          type: "INCREASE",
          reason: "Stock replenishment",
          batchNumber: batchNumber || null,
          expiryDate: expiryDate || null,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Added ${addQuantity} units to ${selectedProduct.name}. New stock: ${selectedProduct.quantity + addQuantity}`,
        })
        onSuccess()
      } else {
        const data = await response.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to update stock",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const incrementUnits = (amount: number) => {
    const current = parseInt(unitsToAdd) || 0
    setUnitsToAdd((current + amount).toString())
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <PackagePlus className="h-5 w-5 mr-2" />
            Update Stock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedProduct ? (
            <>
              <div className="space-y-2">
                <Label>Search Product</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-lg">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No products found
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className="w-full p-3 text-left hover:bg-muted/20 border-b last:border-b-0 transition-colors"
                    >
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        SKU: {product.sku} | Current Stock: {product.quantity} {product.unitOfMeasure}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900">{selectedProduct.name}</h3>
                <p className="text-sm text-blue-800">SKU: {selectedProduct.sku}</p>
                <p className="text-sm text-blue-800 mt-2">
                  Current Stock: <strong>{selectedProduct.quantity} {selectedProduct.unitOfMeasure}</strong>
                </p>
                {selectedProduct.batchNumber && (
                  <p className="text-sm text-blue-800">Batch: {selectedProduct.batchNumber}</p>
                )}
                {selectedProduct.expiryDate && (
                  <p className="text-sm text-blue-800">Expiry: {new Date(selectedProduct.expiryDate).toLocaleDateString()}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="units-to-add">Basic Units to Add</Label>
                <div className="flex gap-2">
                  <Input
                    id="units-to-add"
                    type="number"
                    min="1"
                    value={unitsToAdd}
                    onChange={(e) => setUnitsToAdd(e.target.value)}
                    placeholder="Enter quantity"
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" variant="outline" size="sm" onClick={() => incrementUnits(10)}>
                    +10
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => incrementUnits(25)}>
                    +25
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => incrementUnits(50)}>
                    +50
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => incrementUnits(100)}>
                    +100
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batch-number">Batch Number</Label>
                  <Input
                    id="batch-number"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="e.g., BATCH-2026-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry-date">Expiry Date</Label>
                  <Input
                    id="expiry-date"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              {unitsToAdd && parseInt(unitsToAdd) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    New Stock after update: <strong>{selectedProduct.quantity + parseInt(unitsToAdd)} {selectedProduct.unitOfMeasure}</strong>
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedProduct(null)
                  setUnitsToAdd("")
                  setBatchNumber("")
                  setExpiryDate("")
                }}
              >
                ← Select Different Product
              </Button>
            </>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStock}
              disabled={isLoading || !selectedProduct || !unitsToAdd}
            >
              {isLoading ? "Updating..." : "Update Stock"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
