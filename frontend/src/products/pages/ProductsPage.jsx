import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { AlertTriangle, CircleCheck, Download, FolderCog, Package, PackageX, Pencil, Plus, Save, Upload } from 'lucide-react'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import * as XLSX from 'xlsx'
import {
  createCategory,
  getCategories,
  getProductCostLots,
  getProductMovements,
  getProducts,
  importProducts,
  importProductImagesFromExcel,
  uploadProductImage,
  updateCategory,
  updateProduct,
} from '../../api/api'
import { apiOrigin } from '../../api/apiConfig'
import AppTable from '../../components/common/AppTable'
import SummaryCard from '../../Dashboard/components/SummaryCard'
import { useAuthStore } from '../../store/authStore'
import { formatDisplayDateTime } from '../../utils/dateUtils'
import { exportRowsToExcel } from '../../utils/excelUtils'
import { normalizeBarcodeInput, normalizePlainName } from '../../utils/inputGuards'
import ProductDataTable from '../components/ProductDataTable'

const defaultProductForm = {
  barcode: '',
  categoryName: 'General',
  conversionQty: 1,
  imageName: '',
  issueUnit: '',
  locationId: 'MAIN',
  productId: '',
  productName: '',
  productRemark: '',
  receiveQty: 0,
  receiveUnit: '',
  status: 'Active',
  stockQty: 0,
  totalReceiveQty: 0,
  unit: '',
}

const defaultCategoryForm = {
  categoryId: '',
  categoryName: '',
  categoryStatus: 1,
}

const productExportColumns = [
  { header: 'รหัสสินค้า', value: (row) => row.productId },
  { header: 'Barcode', value: (row) => row.barcode },
  { header: 'ชื่อสินค้า', value: (row) => row.productName },
  { header: 'หมวดหมู่', value: (row) => row.categoryName },
  { header: 'รับเข้าเป็น', value: (row) => row.receiveUnit },
  { header: 'เบิกออกเป็น', value: (row) => row.issueUnit },
  { header: 'จำนวนต่อ 1 หน่วยรับเข้า', value: (row) => row.conversionQty },
  { header: 'ยอดคงเหลือ', value: (row) => row.stockQty },
  { header: 'ต้นทุน FIFO', value: (row) => row.currentUnitCost },
  { header: 'มูลค่าต้นทุนรวม', value: (row) => row.remainingCostValue },
  { header: 'หมายเหตุสินค้า', value: (row) => row.productRemark },
  { header: 'สถานะ', value: (row) => (row.status === 'Active' ? 'ใช้งาน' : 'ไม่ใช้งาน') },
]

function mapProduct(row) {
  const unit = row.unit || row.Unit || '-'
  const conversionQty = Number(row.conversionQty ?? row.ConversionQty ?? 1)

  return {
    barcode: row.barcode ?? row.Barcode ?? '',
    categoryName: row.categoryName ?? row.CategoryName ?? row.category ?? row.Category ?? 'General',
    conversionQty: conversionQty > 0 ? conversionQty : 1,
    currentUnitCost: Number(row.currentUnitCost ?? row.CurrentUnitCost ?? 0),
    imageName: row.imageName ?? row.ImageName ?? '',
    issueUnit: row.issueUnit || row.IssueUnit || unit,
    lastRemark: row.lastRemark ?? row.LastRemark ?? '',
    lastRemarkSource: row.lastRemarkSource ?? row.LastRemarkSource ?? '',
    latestUnitCost: Number(row.latestUnitCost ?? row.LatestUnitCost ?? 0),
    locationId: row.locationId ?? row.LocationId ?? 'MAIN',
    minQty: Number(row.minQty ?? row.MinQty ?? 10),
    productId: row.productId ?? row.ProductId ?? row.code ?? '',
    productName: row.productName ?? row.ProductName ?? row.name ?? '',
  productRemark: row.productRemark ?? row.ProductRemark ?? '',
    receiveQty: Number(row.receiveQty ?? row.ReceiveQty ?? row.lastReceiveQty ?? row.LastReceiveQty ?? 0),
    receiveUnit: row.receiveUnit || row.ReceiveUnit || unit,
    remainingCostValue: Number(row.remainingCostValue ?? row.RemainingCostValue ?? 0),
    status: row.status ?? row.Status ?? 'Active',
    stockQty: Number(row.stockQty ?? row.StockQty ?? 0),
    totalReceiveQty: Number(row.totalReceiveQty ?? row.TotalReceiveQty ?? 0),
    unit,
  }
}

function mapCategory(row) {
  return {
    categoryId: row.categoryId ?? row.CategoryId ?? '',
    categoryName: row.categoryName ?? row.CategoryName ?? '',
    categoryStatus: Number(row.categoryStatus ?? row.CategoryStatus ?? 1),
  }
}

function getProductImageUrl(imageName) {
  if (!imageName) {
    return ''
  }

  const normalizedImageName = String(imageName).trim()

  if (!/\.(jpg|jpeg|png|webp)$/i.test(normalizedImageName)) {
    return ''
  }

  if (/^https?:\/\//i.test(normalizedImageName)) {
    return normalizedImageName
  }

  const baseUrl = apiOrigin

  if (normalizedImageName.startsWith('/')) {
    return `${baseUrl}${normalizedImageName}`
  }

  if (normalizedImageName.startsWith('uploads/')) {
    return `${baseUrl}/${normalizedImageName}`
  }

  return `${baseUrl}/uploads/products/${normalizedImageName}`
}

const importTemplateHeaders = [
  'รูป',
  'รหัส',
  'รายการ',
  'ยอดสต๊อก',
  'รับเข้าเป็น',
  'หน่วยการจ่าย',
  'อัตราแปลง',
  'บาร์โค้ด',
  'หมวดหมู่',
  'ผู้ขาย',
  'Min Stock',
  'ราคาซื้อรวม',
  'หมายเหตุ',
]

const importColumnAliases = {
  barcode: 'barcode',
  category: 'categoryName',
  categoryname: 'categoryName',
  conversionqty: 'conversionQty',
  issueunit: 'issueUnit',
  productid: 'productId',
  productname: 'productName',
  productremark: 'productRemark',
  supplier: 'supplierName',
  suppliername: 'supplierName',
  receiveqty: 'receiveQty',
  receiveunit: 'receiveUnit',
  remark: 'productRemark',
  stockqty: 'stockQty',
  unitcost: 'unitCost',
  รหัส: 'productId',
  รายการ: 'productName',
  ยอดสต๊อก: 'stockQty',
  หน่วยการจ่าย: 'issueUnit',
  หมวดหมู่: 'categoryName',
  จำนวนคงเหลือ: 'stockQty',
  จำนวนรับเข้า: 'receiveQty',
  ต้นทุน: 'unitCost',
  บาร์โค้ด: 'barcode',
  ราคาซื้อ: 'unitCost',
  ราคาซื้อรวม: 'unitCost',
  ผู้ขาย: 'supplierName',
  รับเข้าเป็น: 'receiveUnit',
  รหัสสินค้า: 'productId',
  หน่วยรับเข้า: 'receiveUnit',
  หน่วยเบิก: 'issueUnit',
  หมายเหตุ: 'productRemark',
  อัตราแปลง: 'conversionQty',
  เบิกออกเป็น: 'issueUnit',
  ชื่อสินค้า: 'productName',
}

function getEmployeeId(employee) {
  return Number(employee?.id ?? employee?.employeeId ?? employee?.EmployeeId ?? 0)
}

function getEmployeeName(employee) {
  return (
    employee?.employeeName
    ?? employee?.EmployeeName
    ?? employee?.name
    ?? employee?.username
    ?? employee?.Username
    ?? ''
  )
}

function normalizeImportHeader(header) {
  return String(header ?? '').trim().toLowerCase().replace(/\s/g, '')
}

function parseImportNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const normalized = String(value).replace(/,/g, '').trim()

  if (!normalized || normalized === '-') {
    return fallback
  }
  const parsedValue = Number(normalized)

  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function mapImportRow(row, defaults = {}) {
  const mappedRow = {}

  Object.entries(row).forEach(([key, value]) => {
    const normalizedHeader = normalizeImportHeader(key)
    const mappedKey = importColumnAliases[normalizedHeader]
      ?? (normalizedHeader.startsWith(normalizeImportHeader('ยอดคงเหลือ'))
        ? 'stockQty'
        : (normalizedHeader.startsWith(normalizeImportHeader('min stock'))
          || normalizedHeader.startsWith(normalizeImportHeader('เตือนเมื่อของใกล้หมด')))
          ? 'minQty'
          : undefined)

    if (mappedKey) {
      mappedRow[mappedKey] = value
    }
  })

  const receiveUnit = normalizePlainName(mappedRow.receiveUnit ?? '')
  const issueUnit = normalizePlainName(mappedRow.issueUnit ?? '')
  const conversionQty = parseImportNumber(mappedRow.conversionQty, receiveUnit && issueUnit && receiveUnit === issueUnit ? 1 : 1)
  const receiveQty = parseImportNumber(mappedRow.receiveQty, 0)
  const computedStockQty = receiveQty * (conversionQty > 0 ? conversionQty : 1)
  const importedStockQty = parseImportNumber(mappedRow.stockQty, Number.NaN)
  const stockQty = Number.isFinite(importedStockQty)
    ? Math.max(0, Math.trunc(importedStockQty))
    : Number.isInteger(computedStockQty)
      ? computedStockQty
      : Math.trunc(computedStockQty)

  return {
    barcode: normalizeBarcodeInput(mappedRow.barcode ?? ''),
    categoryName: normalizePlainName(mappedRow.categoryName ?? defaults.categoryName ?? 'General') || 'General',
    conversionQty: conversionQty > 0 ? conversionQty : 1,
    issueUnit: issueUnit || receiveUnit,
    minQty: parseImportNumber(mappedRow.minQty, 10),
    productId: normalizeBarcodeInput(mappedRow.productId ?? ''),
    productName: normalizePlainName(mappedRow.productName ?? ''),
    productRemark: String(mappedRow.productRemark ?? '').trim(),
    receiveQty: receiveQty || stockQty,
    receiveUnit: receiveUnit || issueUnit,
    supplierName: normalizePlainName(mappedRow.supplierName ?? defaults.supplierName ?? ''),
    stockQty,
    unitCost: parseImportNumber(mappedRow.unitCost, 0),
  }
}

function getCatalogHeaderMap(row) {
  const headerMap = {}

  row.forEach((value, columnIndex) => {
    const mappedKey = importColumnAliases[normalizeImportHeader(value)]

    if (mappedKey) {
      headerMap[mappedKey] = columnIndex
    }
  })

  return headerMap.productId !== undefined
    && headerMap.productName !== undefined
    && headerMap.issueUnit !== undefined
    ? headerMap
    : null
}

function readCatalogRows(workbook) {
  const rows = []

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName]
    const sheetRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false })
    let headerMap = null
    let categoryName = sheetName

    sheetRows.forEach((sheetRow, rowIndex) => {
      const nextHeaderMap = getCatalogHeaderMap(sheetRow)

      if (nextHeaderMap) {
        headerMap = nextHeaderMap
        const heading = sheetRows[rowIndex - 1]?.find((value) => String(value ?? '').trim())
        categoryName = normalizePlainName(heading || sheetName) || sheetName
        return
      }

      if (!headerMap) {
        return
      }

      const row = Object.fromEntries(
        Object.entries(headerMap).map(([field, columnIndex]) => [field, sheetRow[columnIndex] ?? '']),
      )
      const mappedRow = mapImportRow(row, {
        categoryName,
        supplierName: 'นำเข้าจากแคตตาล็อก',
      })

      if (mappedRow.productId || mappedRow.productName) {
        rows.push({ ...mappedRow, rowNo: `${sheetName} · แถว ${rowIndex + 1}`, sourceRowNo: rowIndex + 1, sourceSheetName: sheetName })
      }
    })
  })

  return rows
}

function ProductsPage() {
  const employee = useAuthStore((state) => state.employee)
  const employeeId = getEmployeeId(employee)
  const employeeName = getEmployeeName(employee)
  const [categories, setCategories] = useState([])
  const [categoryForm, setCategoryForm] = useState(defaultCategoryForm)
  const [confirmSaveType, setConfirmSaveType] = useState('')
  const [editForm, setEditForm] = useState(defaultProductForm)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [costLotsData, setCostLotsData] = useState(null)
  const [expandedProductId, setExpandedProductId] = useState('')
  const [isCostLotsLoading, setIsCostLotsLoading] = useState(false)
  const [movementData, setMovementData] = useState({})
  const [movementErrors, setMovementErrors] = useState({})
  const [movementLoading, setMovementLoading] = useState({})
  const [importFileName, setImportFileName] = useState('')
  const [importFile, setImportFile] = useState(null)
  const [importRows, setImportRows] = useState([])
  const [products, setProducts] = useState([])
  const [selectedRemarkProduct, setSelectedRemarkProduct] = useState(null)
  const [selectedRemarkType, setSelectedRemarkType] = useState('latest')
  const [statusFilter, setStatusFilter] = useState('all')
  const activeCategoryOptions = useMemo(() => {
    const categoryNames = [
      ...categories
        .filter((category) => category.categoryStatus === 1)
        .map((category) => category.categoryName),
      ...products.map((product) => product.categoryName),
      'General',
    ]

    return [...new Set(categoryNames.map((name) => String(name ?? '').trim()).filter(Boolean))]
  }, [categories, products])

  const productSummary = useMemo(
    () => ({
      productCount: products.length,
      readyCount: products.filter((product) => product.stockQty > product.minQty).length,
      lowStockCount: products.filter((product) => product.stockQty > 0 && product.stockQty <= product.minQty).length,
      outOfStockCount: products.filter((product) => product.stockQty <= 0).length,
    }),
    [products],
  )

  const filteredProducts = useMemo(
    () => statusFilter === 'all'
      ? products
      : products.filter((product) => {
        const stockQty = Number(product.stockQty ?? 0)
        const minQty = Number(product.minQty ?? 10)
        const stockStatus = stockQty > minQty ? 'ready' : stockQty > 0 ? 'low' : 'out'

        return stockStatus === statusFilter
      }),
    [products, statusFilter],
  )

  const loadProducts = async () => {
    setIsLoading(true)
    setLoadError('')

    try {
      const data = await getProducts()

      setProducts((data ?? []).map(mapProduct))
    } catch {
      setLoadError('โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาตรวจสอบว่า Backend API เปิดอยู่')
    } finally {
      setIsLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const data = await getCategories()

      setCategories((data ?? []).map(mapCategory))
    } catch {
      toast.error('โหลดข้อมูลหมวดหมู่ไม่สำเร็จ')
    }
  }

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [])

  const handleEdit = (product) => {
    setEditForm(product)
    setIsEditOpen(true)
  }

  const handleViewCostLots = async (product) => {
    setCostLotsData({
      productId: product.productId,
      productName: product.productName,
      issueUnit: product.issueUnit,
      lots: [],
      totalLots: 0,
      averageUnitCost: 0,
      supplierSummaries: [],
      totalRemainingCostValue: product.remainingCostValue,
      totalRemainingQty: product.stockQty,
    })
    setIsCostLotsLoading(true)

    try {
      const data = await getProductCostLots(product.productId)

      setCostLotsData({
        issueUnit: data.issueUnit ?? data.IssueUnit ?? product.issueUnit,
        lots: (data.lots ?? data.Lots ?? []).map((lot) => ({
          costLotId: lot.costLotId ?? lot.CostLotId,
          originalQty: Number(lot.originalQty ?? lot.OriginalQty ?? 0),
          receiveDate: lot.receiveDate ?? lot.ReceiveDate,
          receiveDateText: formatDisplayDateTime(lot.receiveDate ?? lot.ReceiveDate),
          remainingCostValue: Number(lot.remainingCostValue ?? lot.RemainingCostValue ?? 0),
          remainingQty: Number(lot.remainingQty ?? lot.RemainingQty ?? 0),
          supplierId: lot.supplierId ?? lot.SupplierId ?? null,
          supplierName: lot.supplierName ?? lot.SupplierName ?? 'ไม่ระบุผู้ขาย',
          unitCost: Number(lot.unitCost ?? lot.UnitCost ?? 0),
        })),
        averageUnitCost: Number(data.averageUnitCost ?? data.AverageUnitCost ?? 0),
        productId: data.productId ?? data.ProductId ?? product.productId,
        productName: data.productName ?? data.ProductName ?? product.productName,
        supplierSummaries: (data.supplierSummaries ?? data.SupplierSummaries ?? []).map((summary) => ({
          averageUnitCost: Number(summary.averageUnitCost ?? summary.AverageUnitCost ?? 0),
          latestReceiveDate: summary.latestReceiveDate ?? summary.LatestReceiveDate,
          latestReceiveDateText: formatDisplayDateTime(
            summary.latestReceiveDate ?? summary.LatestReceiveDate,
          ),
          latestUnitCost: Number(summary.latestUnitCost ?? summary.LatestUnitCost ?? 0),
          supplierId: summary.supplierId ?? summary.SupplierId ?? null,
          supplierName: summary.supplierName ?? summary.SupplierName ?? 'ไม่ระบุผู้ขาย',
          totalLots: Number(summary.totalLots ?? summary.TotalLots ?? 0),
          totalRemainingCostValue: Number(
            summary.totalRemainingCostValue ?? summary.TotalRemainingCostValue ?? 0,
          ),
          totalRemainingQty: Number(summary.totalRemainingQty ?? summary.TotalRemainingQty ?? 0),
        })),
        totalLots: Number(data.totalLots ?? data.TotalLots ?? 0),
        totalRemainingCostValue: Number(data.totalRemainingCostValue ?? data.TotalRemainingCostValue ?? 0),
        totalRemainingQty: Number(data.totalRemainingQty ?? data.TotalRemainingQty ?? 0),
      })
    } catch {
      await Swal.fire({
        title: 'ไม่สำเร็จ',
        text: 'โหลดรายละเอียดต้นทุนไม่สำเร็จ กรุณาตรวจสอบ Backend API',
        icon: 'error',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
      setCostLotsData(null)
    } finally {
      setIsCostLotsLoading(false)
    }
  }

  const handleToggleMovements = async (product) => {
    const productId = product.productId

    if (expandedProductId === productId) {
      setExpandedProductId('')

      return
    }

    setExpandedProductId(productId)

    if (movementData[productId] || movementLoading[productId]) {
      return
    }

    setMovementErrors((current) => ({
      ...current,
      [productId]: '',
    }))
    setMovementLoading((current) => ({
      ...current,
      [productId]: true,
    }))

    try {
      const data = await getProductMovements(productId)

      setMovementData((current) => ({
        ...current,
        [productId]: data,
      }))
    } catch {
      setMovementErrors((current) => ({
        ...current,
        [productId]: 'โหลดประวัตินำเข้า/เบิกไม่สำเร็จ กรุณาตรวจสอบ Backend API',
      }))
    } finally {
      setMovementLoading((current) => ({
        ...current,
        [productId]: false,
      }))
    }
  }

  const handleProductFormChange = (field, value) => {
    const nextValue = field === 'barcode'
      ? normalizeBarcodeInput(value)
      : field === 'productName' || field === 'categoryName'
        ? normalizePlainName(value)
        : value

    setEditForm((current) => ({
      ...current,
      [field]: nextValue,
    }))
  }

  const handleProductImageChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      Swal.fire({
        title: 'ไม่สำเร็จ',
        text: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น',
        icon: 'error',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
      return
    }

    try {
      const uploadedImage = await uploadProductImage(file)

      handleProductFormChange('imageName', uploadedImage.url ?? uploadedImage.Url ?? '')
      toast.success('อัปโหลดรูปสินค้าสำเร็จ')
    } catch {
      Swal.fire({
        title: 'ไม่สำเร็จ',
        text: 'อัปโหลดรูปสินค้าไม่สำเร็จ กรุณาตรวจสอบ Backend API',
        icon: 'error',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
    }
  }

  const handleCategoryFormChange = (field, value) => {
    const nextValue = field === 'categoryName' ? normalizePlainName(value) : value

    setCategoryForm((current) => ({
      ...current,
      [field]: nextValue,
    }))
  }

  const openCreateCategory = () => {
    setCategoryForm(defaultCategoryForm)
    setIsCategoryFormOpen(true)
  }

  const openEditCategory = (category) => {
    setCategoryForm(category)
    setIsCategoryFormOpen(true)
  }

  const canSaveProduct =
    editForm.productId.trim()
    && editForm.productName.trim()

  const canSaveCategory = categoryForm.categoryName.trim()
  const canImportProducts = importRows.length > 0
    && importRows.every((row) => row.errors.length === 0)

  const handleExportProducts = () => {
    exportRowsToExcel(
      products,
      productExportColumns,
      `products-${dayjs().format('YYYYMMDD-HHmm')}.xlsx`,
    )
  }

  const validateImportRows = (rows) => {
    const existingProductsById = new Map(
      products.map((product) => [product.productId.toLowerCase(), product]),
    )
    const existingProductsByBarcode = new Map(
      products
        .filter((product) => product.barcode)
        .map((product) => [product.barcode.toLowerCase(), product]),
    )
    const fileProductIds = new Set()
    const fileBarcodes = new Set()

    return rows.map((row) => {
      const errors = []
      const productIdKey = row.productId.toLowerCase()
      const barcodeKey = row.barcode.toLowerCase()

      if (!row.productId) {
        errors.push('กรุณากรอกรหัสสินค้า')
      } else if (existingProductsById.has(productIdKey)) {
        const product = existingProductsById.get(productIdKey)
        errors.push(`รหัสสินค้า ${product.productId} (${product.productName}) มีอยู่แล้ว`)
      } else if (fileProductIds.has(productIdKey)) {
        errors.push('รหัสสินค้าซ้ำในไฟล์')
      }

      if (row.barcode) {
        if (existingProductsByBarcode.has(barcodeKey)) {
          const product = existingProductsByBarcode.get(barcodeKey)
          errors.push(`Barcode นี้เป็นของ ${product.productId} (${product.productName}) ที่มีอยู่แล้ว`)
        } else if (fileBarcodes.has(barcodeKey)) {
          errors.push('Barcode ซ้ำในไฟล์')
        }
      }

      if (!row.productName) {
        errors.push('กรุณากรอกชื่อสินค้า')
      }

      if (!row.receiveUnit) {
        errors.push('กรุณากรอกหน่วยรับเข้า')
      }

      if (!row.issueUnit) {
        errors.push('กรุณากรอกหน่วยเบิก')
      }

      if (!row.supplierName) {
        errors.push('กรุณากรอกผู้ขาย')
      }

      if (row.conversionQty <= 0) {
        errors.push('อัตราแปลงต้องมากกว่า 0')
      }

      if (row.stockQty < 0) {
        errors.push('ยอดคงเหลือต้องไม่ติดลบ')
      }

      if (row.minQty < 0) {
        errors.push('จำนวนแจ้งเตือนต้องไม่ติดลบ')
      }

      if (row.unitCost < 0) {
        errors.push('ราคาซื้อรวมต้องไม่ติดลบ')
      }

      if (row.productId) {
        fileProductIds.add(productIdKey)
      }

      if (row.barcode) {
        fileBarcodes.add(barcodeKey)
      }

      return {
        ...row,
        errors,
      }
    })
  }

  const handleDownloadImportTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['แค็ตตาล็อกสินค้า สำหรับนำเข้าระบบ Stock Issue'],
      ['วางรูปในคอลัมน์ “รูป” ให้ตรงกับแถวสินค้าเดียวกัน · หากรูปเดียวใช้หลายสินค้า ให้ขยายรูปครอบคลุมแถวของสินค้านั้น · อัตราแปลง 12 หมายถึง รับเข้า 1 กล่อง × 12 = 12 ชิ้น (หน่วยเบิก)'],
      [],
      importTemplateHeaders,
    ])
    worksheet['!merges'] = [
      { s: { c: 0, r: 0 }, e: { c: importTemplateHeaders.length - 1, r: 0 } },
      { s: { c: 0, r: 1 }, e: { c: importTemplateHeaders.length - 1, r: 1 } },
    ]
    worksheet['!cols'] = [
      { wch: 16 }, { wch: 22 }, { wch: 36 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 25 }, { wch: 22 }, { wch: 25 }, { wch: 20 }, { wch: 16 }, { wch: 28 },
    ]
    worksheet['!rows'] = [{ hpt: 28 }, { hpt: 34 }, {}, { hpt: 24 }]
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'แค็ตตาล็อกสินค้า')
    XLSX.writeFile(workbook, 'stock-issue-catalog-template.xlsx')
  }

  const closeImportDialog = () => {
    setIsImportOpen(false)
    setImportFile(null)
    setImportFileName('')
    setImportRows([])
  }

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    setImportFileName(file.name)
    setImportFile(file)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const mappedRows = readCatalogRows(workbook)

      if (mappedRows.length === 0) {
        throw new Error('No supported product rows found')
      }

      setImportRows(validateImportRows(mappedRows))
    } catch {
      setImportRows([])
      await Swal.fire({
        title: 'ไม่สำเร็จ',
        text: 'อ่านไฟล์ Excel ไม่สำเร็จ กรุณาตรวจสอบไฟล์อีกครั้ง',
        icon: 'error',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
    }
  }

  const handleConfirmImport = async () => {
    if (!canImportProducts) {
      return
    }

    const zeroStockRows = importRows.filter((row) => Number(row.stockQty ?? 0) <= 0)

    if (zeroStockRows.length > 0) {
      const zeroStockResult = await Swal.fire({
        title: 'พบยอดคงเหลือเป็น 0',
        html: `
          <div style="text-align:left;line-height:1.7">
            <p>มีสินค้า ${zeroStockRows.length.toLocaleString('th-TH')} รายการที่ยอดคงเหลือเป็น 0</p>
            <p>กรุณาตรวจสอบว่าใส่ยอดเป็น 0 จริง หรือระบบไม่สามารถอ่านค่ายอดคงเหลือจากไฟล์ Excel ได้</p>
            <p style="font-weight:700">ถ้ายืนยัน ระบบจะนำเข้ารายการเหล่านี้ด้วยยอดคงเหลือ 0</p>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันนำเข้า',
        cancelButtonText: 'กลับไปตรวจสอบ',
        customClass: {
          container: 'stock-swal-container',
        },
      })

      if (!zeroStockResult.isConfirmed) {
        return
      }
    }

    const confirmResult = await Swal.fire({
      title: 'ยืนยันนำเข้า Excel',
      text: `ต้องการนำเข้าสินค้า ${importRows.length.toLocaleString('th-TH')} รายการใช่หรือไม่`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      customClass: {
        container: 'stock-swal-container',
      },
    })

    if (!confirmResult.isConfirmed) {
      return
    }

    setIsImporting(true)

    try {
      await importProducts({
        employeeId,
        employeeName,
        items: importRows.map(({ errors: _errors, rowNo: _rowNo, ...row }) => row),
      })
      if (importFile) {
        await importProductImagesFromExcel(importFile, importRows.map((row) => ({ sheetName: row.sourceSheetName, rowNo: row.sourceRowNo, productId: row.productId })))
      }
      setIsImportOpen(false)
      setImportRows([])
      setImportFileName('')
      setImportFile(null)
      await loadProducts()
      await loadCategories()
      await Swal.fire({
        title: 'สำเร็จ',
        text: 'นำเข้าสินค้าจาก Excel สำเร็จ',
        icon: 'success',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
    } catch (error) {
      const errorData = error?.response?.data
      const duplicateBalanceIds = errorData?.productIds ?? errorData?.ProductIds
      const existingProducts = errorData?.existingProducts ?? errorData?.ExistingProducts
      const existingProductsText = existingProducts?.length
        ? existingProducts.map((product) => `${product.productId ?? product.ProductId} (${product.productName ?? product.ProductName})`).join(', ')
        : ''
      const message = existingProductsText
        ? `พบสินค้าที่มีอยู่แล้วในระบบ: ${existingProductsText}`
        : duplicateBalanceIds?.length
        ? `พบยอดคงเหลือของรหัสสินค้า ${duplicateBalanceIds.join(', ')} ค้างอยู่ในระบบ กรุณาตรวจสอบข้อมูลเดิม หรือใช้เมนูปรับสต๊อกแทน`
        : errorData?.message
          ?? errorData?.Message
          ?? (typeof errorData === 'string' ? errorData : null)
          ?? 'นำเข้าสินค้าจาก Excel ไม่สำเร็จ'

      await Swal.fire({
        title: 'ไม่สำเร็จ',
        text: String(message),
        icon: 'error',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleSaveProduct = async () => {
    if (!canSaveProduct) {
      return
    }

    setIsSaving(true)

    try {
      const updatedProduct = await updateProduct(editForm.productId, {
        barcode: editForm.barcode,
        categoryName: editForm.categoryName,
        imageName: editForm.imageName ?? '',
        productName: editForm.productName,
        productRemark: editForm.productRemark,
        status: editForm.status,
      })

      setProducts((current) =>
        current.map((product) =>
          product.productId === editForm.productId ? mapProduct(updatedProduct) : product,
        ),
      )
      setIsEditOpen(false)
      await Swal.fire({
        title: 'สำเร็จ',
        text: 'บันทึกข้อมูลสินค้าสำเร็จ',
        icon: 'success',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
    } catch {
      await Swal.fire({
        title: 'ไม่สำเร็จ',
        text: 'บันทึกข้อมูลสินค้าไม่สำเร็จ',
        icon: 'error',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveCategory = async () => {
    if (!canSaveCategory) {
      return
    }

    setIsSavingCategory(true)

    const payload = {
      categoryName: categoryForm.categoryName.trim(),
      categoryStatus: Number(categoryForm.categoryStatus),
    }

    try {
      const savedCategory = categoryForm.categoryId
        ? await updateCategory(categoryForm.categoryId, payload)
        : await createCategory(payload)
      const mappedCategory = mapCategory(savedCategory)

      setCategories((current) =>
        categoryForm.categoryId
          ? current.map((category) =>
            category.categoryId === mappedCategory.categoryId ? mappedCategory : category,
          )
          : [mappedCategory, ...current],
      )
      setIsCategoryFormOpen(false)
      await Swal.fire({
        title: 'สำเร็จ',
        text: 'บันทึกหมวดหมู่สำเร็จ',
        icon: 'success',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
    } catch {
      await Swal.fire({
        title: 'ไม่สำเร็จ',
        text: 'บันทึกหมวดหมู่ไม่สำเร็จ',
        icon: 'error',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
    } finally {
      setIsSavingCategory(false)
    }
  }

  const categoryColumns = [
    {
      key: 'actions',
      label: 'แก้ไข',
      width: 120,
      align: 'center',
      searchable: false,
      sortable: false,
      render: (row) => (
        <Button
          startIcon={<Pencil size={16} />}
          size="small"
          variant="outlined"
          onClick={() => openEditCategory(row)}
        >
          แก้ไข
        </Button>
      ),
    },
    { key: 'categoryId', label: 'รหัส', width: 90, align: 'center', sortValue: (row) => Number(row.categoryId ?? 0) },
    { key: 'categoryName', label: 'ชื่อหมวดหมู่', width: 280, align: 'left' },
    {
      key: 'categoryStatus',
      label: 'สถานะ',
      width: 130,
      align: 'center',
      searchable: false,
      render: (row) => (
        <Chip
          color={row.categoryStatus === 1 ? 'success' : 'error'}
          label={row.categoryStatus === 1 ? 'ใช้งาน' : 'ไม่ใช้งาน'}
          size="small"
        />
      ),
    },
  ]

  return (
    <Stack spacing={2.5}>
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#111827', fontSize: 24, fontWeight: 800 }}>
            สินค้า / ยอดคงเหลือ
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: 14, mt: 0.5 }}>
            ค้นหาข้อมูลสินค้า ยอดคงเหลือ หน่วยรับเข้า หน่วยส่งออก และจัดการหมวดหมู่สินค้า
          </Typography>
        </Box>

      </Stack>

      {loadError ? <Alert severity="error">{loadError}</Alert> : null}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            color="#2563eb"
            icon={Package}
            label="จำนวนสินค้าทั้งหมด"
            value={productSummary.productCount.toLocaleString('th-TH')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            color="#16a34a"
            icon={CircleCheck}
            label="สินค้าพร้อมเบิก"
            value={productSummary.readyCount.toLocaleString('th-TH')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            color="#f59e0b"
            icon={AlertTriangle}
            label="สินค้าใกล้หมด"
            value={productSummary.lowStockCount.toLocaleString('th-TH')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            color="#dc2626"
            icon={PackageX}
            label="สินค้าหมด"
            value={productSummary.outOfStockCount.toLocaleString('th-TH')}
          />
        </Grid>
      </Grid>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          justifyContent: 'flex-end',
          width: '100%',
        }}
      >
        <Button
          disabled={!products.length}
          startIcon={<Download size={18} />}
          sx={{ fontWeight: 700, height: 40, minWidth: 150, py: 0 }}
          variant="outlined"
          onClick={handleExportProducts}
        >
          ส่งออก Excel
        </Button>
        <Button
          component="label"
          startIcon={<Upload size={18} />}
          sx={{ fontWeight: 700, height: 40, minWidth: 140, py: 0 }}
          variant="contained"
          onClick={() => setIsImportOpen(true)}
        >
          นำเข้า Excel
        </Button>
        <Button
          startIcon={<FolderCog size={18} />}
          sx={{ fontWeight: 700, height: 40, minWidth: 160, py: 0 }}
          variant="outlined"
          onClick={() => setIsCategoryDialogOpen(true)}
        >
          จัดการหมวดหมู่
        </Button>
      </Box>

      <Card
        elevation={0}
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #d9e0ea',
          borderRadius: 2,
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <ProductDataTable
            data={filteredProducts}
            expandedProductId={expandedProductId}
            isLoading={isLoading}
            movementData={movementData}
            movementErrors={movementErrors}
            movementLoading={movementLoading}
            onEdit={handleEdit}
            onToggleMovements={handleToggleMovements}
            onViewCostLots={handleViewCostLots}
            onViewRemark={(product, type = 'latest') => {
              setSelectedRemarkProduct(product)
              setSelectedRemarkType(type)
            }}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        </CardContent>
      </Card>

      <Dialog
        fullWidth
        maxWidth={false}
        open={isImportOpen}
        PaperProps={{ sx: { height: 'calc(100vh - 32px)', maxWidth: 'none', width: 'calc(100vw - 32px)' } }}
        onClose={closeImportDialog}
      >
        <DialogTitle>นำเข้า Excel สินค้า</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              รองรับแค็ตตาล็อกที่มีหลายชีตและหัวตารางซ้ำ โดยใช้รหัสสินค้า ชื่อสินค้า ยอดสต๊อก หน่วยการจ่าย และบาร์โค้ดตามไฟล์ต้นฉบับ ส่วนผู้ขายจะตั้งเป็น “นำเข้าจากแค็ตตาล็อก”, ราคาซื้อรวมเป็น 0 และจุดแจ้งเตือนเป็น 10 หน่วย หากไฟล์ไม่ได้ระบุไว้
            </Alert>

            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={1.5}>
                <Button
                  startIcon={<Download size={18} />}
                  variant="outlined"
                  onClick={handleDownloadImportTemplate}
                >
                  ดาวน์โหลดเทมเพลต
                </Button>
                <Button component="label" startIcon={<Upload size={18} />} variant="contained">
                  เลือกไฟล์ Excel
                  <input
                    hidden
                    accept=".xlsx,.xls"
                    type="file"
                    onChange={handleImportFileChange}
                  />
                </Button>
              </Stack>
              <Typography sx={{ color: '#64748b', fontSize: 14 }}>
                {importFileName || 'ยังไม่ได้เลือกไฟล์'}
              </Typography>
            </Stack>

            <AppTable
              columns={[
                {
                  key: 'errors',
                  label: 'สถานะตรวจสอบ',
                  width: 260,
                  align: 'center',
                  searchable: false,
                  render: (row) =>
                    row.errors.length === 0 ? (
                      <Chip color="success" label="พร้อมนำเข้า" size="small" />
                    ) : (
                      <Chip color="error" label={row.errors.join(', ')} size="small" />
                    ),
                },
                { key: 'productId', label: 'รหัสสินค้า', width: 150, align: 'center' },
                { key: 'barcode', label: 'Barcode', width: 170, align: 'center' },
                { key: 'productName', label: 'ชื่อสินค้า', width: 240, align: 'center' },
                { key: 'supplierName', label: 'ผู้ขาย', width: 180, align: 'center' },
                { key: 'categoryName', label: 'หมวดหมู่', width: 140, align: 'center' },
                { key: 'receiveUnit', label: 'รับเข้าเป็น', width: 120, align: 'center' },
                { key: 'issueUnit', label: 'เบิกออกเป็น', width: 120, align: 'center' },
                { key: 'conversionQty', label: 'อัตราแปลง', width: 120, align: 'center' },
                { key: 'receiveQty', label: 'จำนวนรับเข้า', width: 130, align: 'center' },
                { key: 'stockQty', label: 'ยอดคงเหลือ (หน่วยเบิก)', width: 160, align: 'center' },
                { key: 'minQty', label: 'Min Stock', width: 170, align: 'center' },
                {
                  key: 'unitCost',
                  label: 'ราคาซื้อรวม',
                  width: 130,
                  align: 'center',
                  render: (row) =>
                    Number(row.unitCost ?? 0).toLocaleString('th-TH', {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    }),
                },
              ]}
              defaultSortField="rowNo"
              maxHeight="520px"
              noDataText="เลือกไฟล์ Excel เพื่อดูตัวอย่างข้อมูล"
              rowKey="rowNo"
              rows={importRows}
              showGlobalSearch
            />

            {importRows.some((row) => row.errors.length > 0) ? (
              <Alert severity="error">
                พบข้อมูลผิดพลาด กรุณาแก้ไฟล์ Excel แล้วเลือกไฟล์ใหม่ก่อนนำเข้า
              </Alert>
            ) : null}
            {isEditOpen ? (
            <Box>
              <Typography sx={{ color: '#0f172a', fontWeight: 800, mb: 1 }}>
                รูปสินค้า
              </Typography>
              <Box
                sx={{
                  border: '1px dashed #bfdbfe',
                  borderRadius: 1.5,
                  bgcolor: '#f8fafc',
                  p: 1.5,
                }}
              >
                {getProductImageUrl(editForm.imageName) ? (
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Box
                      alt={editForm.productName || 'product'}
                      component="img"
                      src={getProductImageUrl(editForm.imageName)}
                      sx={{
                        bgcolor: '#fff',
                        border: '1px solid #dbeafe',
                        borderRadius: 1.5,
                        height: 96,
                        objectFit: 'cover',
                        width: 140,
                      }}
                    />
                    <Stack spacing={1}>
                      <Typography sx={{ color: '#475569', fontSize: 14 }}>
                        อัปโหลดรูปสินค้าแล้ว
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          component="label"
                          size="small"
                          startIcon={<Upload size={16} />}
                          variant="outlined"
                        >
                          เปลี่ยนรูป
                          <input hidden accept="image/*" type="file" onChange={handleProductImageChange} />
                        </Button>
                        <Button
                          color="error"
                          size="small"
                          variant="outlined"
                          onClick={() => handleProductFormChange('imageName', '')}
                        >
                          ลบรูป
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                ) : (
                  <Button
                    component="label"
                    fullWidth
                    startIcon={<Upload size={18} />}
                    variant="outlined"
                  >
                    แนบรูปสินค้า
                    <input hidden accept="image/*" type="file" onChange={handleProductImageChange} />
                  </Button>
                )}
              </Box>
            </Box>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={closeImportDialog}>
            ยกเลิก
          </Button>
          <Button
            disabled={!canImportProducts || isImporting}
            startIcon={<Save size={18} />}
            variant="contained"
            onClick={handleConfirmImport}
          >
            ยืนยันนำเข้า
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="md" open={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <DialogTitle>แก้ไขข้อมูลสินค้า</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={4}>
                <TextField
                  disabled
                  fullWidth
                  helperText="รหัสที่ใช้อ้างอิงสินค้า แก้ไขจากหน้านี้ไม่ได้"
                  label="รหัสสินค้า"
                  value={editForm.productId}
                />
              </Grid>
              <Grid size={4}>
                <TextField
                  fullWidth
                  required
                  helperText="ชื่อที่ผู้ใช้งานเห็นตอนค้นหาและเบิกสินค้า"
                  label="ชื่อสินค้า"
                  value={editForm.productName}
                  onChange={(event) => handleProductFormChange('productName', event.target.value)}
                />
              </Grid>
              <Grid size={4}>
                <TextField
                  fullWidth
                  select
                  helperText="ใช้จัดกลุ่มสินค้าในหน้าเบิกและรายงาน"
                  label="หมวดหมู่"
                  value={editForm.categoryName}
                  onChange={(event) => handleProductFormChange('categoryName', event.target.value)}
                >
                  {activeCategoryOptions
                    .map((categoryName) => (
                      <MenuItem key={categoryName} value={categoryName}>
                        {categoryName}
                      </MenuItem>
                    ))}
                </TextField>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Barcode"
                  helperText="ใช้ยิงสแกน ถ้าไม่มีให้เว้นว่างได้"
                  value={editForm.barcode}
                  onChange={(event) => handleProductFormChange('barcode', event.target.value)}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Grid size={4}>
                <TextField
                  disabled
                  fullWidth
                  required
                  helperText="หน่วยตอนซื้อหรือรับของเข้า แก้ไขจากหน้านี้ไม่ได้"
                  label="รับเข้าเป็น"
                  value={editForm.receiveUnit}
                />
              </Grid>
              <Grid size={4}>
                <TextField
                  disabled
                  fullWidth
                  helperText="จำนวนรับเข้าจริงจากรายการรับเข้าล่าสุด"
                  label="รับเข้าล่าสุด"
                  value={`${Number(editForm.receiveQty ?? 0).toLocaleString('th-TH')} ${editForm.receiveUnit || ''}`.trim()}
                />
              </Grid>
              <Grid size={4}>
                <TextField
                  disabled
                  fullWidth
                  helperText="รวมจำนวนรับเข้าทุกรอบก่อนแปลงเป็นหน่วยเบิก"
                  label="รวมรับเข้าทั้งหมด"
                  value={`${Number(editForm.totalReceiveQty ?? 0).toLocaleString('th-TH')} ${editForm.receiveUnit || ''}`.trim()}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={5}>
                <TextField
                  disabled
                  fullWidth
                  required
                  helperText={`เช่น 1 ${editForm.receiveUnit || 'แพ็ค'} = ${editForm.conversionQty || '?'} ${editForm.issueUnit || 'ชิ้น'}`}
                  label="จำนวนส่งออกต่อ 1 หน่วยรับเข้า"
                  type="number"
                  value={editForm.conversionQty}
                />
              </Grid>
              <Grid
                size={1}
                sx={{
                  alignItems: 'center',
                  display: 'flex',
                  height: 56,
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ color: '#0f172a', fontSize: 22, fontWeight: 900 }}>=</Typography>
              </Grid>
              <Grid size={6}>
                <TextField
                  disabled
                  fullWidth
                  required
                  helperText="หน่วยที่พนักงานใช้ตอนเบิก"
                  label="ส่งออกเป็น"
                  value={editForm.issueUnit}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  disabled
                  fullWidth
                  required
                  helperText="ยอดคงเหลือแก้ไขจากหน้านี้ไม่ได้ หากต้องการเปลี่ยนยอดให้ใช้เมนูปรับสต๊อก"
                  label="ยอดคงเหลือ"
                  type="number"
                  value={editForm.stockQty}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  select
                  label="สถานะ"
                  value={editForm.status}
                  onChange={(event) => handleProductFormChange('status', event.target.value)}
                >
                  <MenuItem value="Active">ใช้งาน</MenuItem>
                  <MenuItem value="Inactive">ไม่ใช้งาน</MenuItem>
                </TextField>
              </Grid>
            </Grid>

            <TextField
              fullWidth
              helperText="หมายเหตุประจำสินค้า แก้ไขได้จากหน้านี้"
              label="หมายเหตุสินค้า"
              minRows={3}
              multiline
              value={editForm.productRemark}
              onChange={(event) => handleProductFormChange('productRemark', event.target.value)}
            />

            <TextField
              disabled
              fullWidth
              helperText="รายละเอียดจากรายการรับเข้า ถอยยอด หรือปรับสต๊อกล่าสุด แก้ไขจากหน้าสินค้าไม่ได้"
              label="รายละเอียด"
              minRows={3}
              multiline
              value={editForm.lastRemark || 'ไม่มีหมายเหตุ'}
            />

            <Box>
              <Typography sx={{ color: '#0f172a', fontWeight: 800, mb: 1 }}>
                รูปสินค้า
              </Typography>
              <Box
                sx={{
                  border: '1px dashed #bfdbfe',
                  borderRadius: 1.5,
                  bgcolor: '#f8fafc',
                  p: 1.5,
                }}
              >
                {getProductImageUrl(editForm.imageName) ? (
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Box
                      alt={editForm.productName || 'product'}
                      component="img"
                      src={getProductImageUrl(editForm.imageName)}
                      sx={{
                        bgcolor: '#fff',
                        border: '1px solid #dbeafe',
                        borderRadius: 1.5,
                        height: 96,
                        objectFit: 'cover',
                        width: 140,
                      }}
                    />
                    <Stack spacing={1}>
                      <Typography sx={{ color: '#475569', fontSize: 14 }}>
                        อัปโหลดรูปสินค้าแล้ว
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          component="label"
                          size="small"
                          startIcon={<Upload size={16} />}
                          variant="outlined"
                        >
                          เปลี่ยนรูป
                          <input hidden accept="image/*" type="file" onChange={handleProductImageChange} />
                        </Button>
                        <Button
                          color="error"
                          size="small"
                          variant="outlined"
                          onClick={() => handleProductFormChange('imageName', '')}
                        >
                          ลบรูป
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                ) : (
                  <Button
                    component="label"
                    fullWidth
                    startIcon={<Upload size={18} />}
                    variant="outlined"
                  >
                    แนบรูปสินค้า
                    <input hidden accept="image/*" type="file" onChange={handleProductImageChange} />
                  </Button>
                )}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setIsEditOpen(false)}>
            ยกเลิก
          </Button>
          <Button
            disabled={!canSaveProduct || isSaving}
            startIcon={<Save size={18} />}
            variant="contained"
            onClick={() => setConfirmSaveType('product')}
          >
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        fullWidth
        maxWidth="lg"
        open={isCategoryDialogOpen}
        onClose={() => setIsCategoryDialogOpen(false)}
      >
        <DialogTitle sx={{ px: 3, width: '100%' }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
          >
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>จัดการหมวดหมู่สินค้า</Typography>
            <Box sx={{ display: 'flex', flex: 1, justifyContent: 'flex-end' }}>
              <Button
                startIcon={<Plus size={18} />}
                sx={{ fontWeight: 700, height: 40, minWidth: 140, py: 0 }}
                variant="contained"
                onClick={openCreateCategory}
              >
                เพิ่มหมวดหมู่
              </Button>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <AppTable
            columns={categoryColumns}
            defaultSortField="categoryId"
            defaultSortDirection="desc"
            maxHeight="460px"
            noDataText="ไม่พบข้อมูลหมวดหมู่"
            rowKey="categoryId"
            rows={categories}
            showGlobalSearch
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" onClick={() => setIsCategoryDialogOpen(false)}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        fullWidth
        maxWidth="sm"
        open={isCategoryFormOpen}
        onClose={() => setIsCategoryFormOpen(false)}
      >
        <DialogTitle>
          {categoryForm.categoryId ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              required
              label="ชื่อหมวดหมู่"
              value={categoryForm.categoryName}
              onChange={(event) => handleCategoryFormChange('categoryName', event.target.value)}
            />

            <TextField
              fullWidth
              select
              label="สถานะ"
              value={categoryForm.categoryStatus}
              onChange={(event) => handleCategoryFormChange('categoryStatus', event.target.value)}
            >
              <MenuItem value={1}>ใช้งาน</MenuItem>
              <MenuItem value={2}>ไม่ใช้งาน</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setIsCategoryFormOpen(false)}>
            ยกเลิก
          </Button>
          <Button
            disabled={!canSaveCategory || isSavingCategory}
            startIcon={<Save size={18} />}
            variant="contained"
            onClick={() => setConfirmSaveType('category')}
          >
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="xs" open={Boolean(confirmSaveType)} onClose={() => setConfirmSaveType('')}>
        <DialogTitle>ยืนยันการบันทึก</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Alert severity="info">
              {confirmSaveType === 'product'
                ? 'ต้องการบันทึกข้อมูลสินค้านี้ใช่หรือไม่'
                : 'ต้องการบันทึกข้อมูลหมวดหมู่นี้ใช่หรือไม่'}
            </Alert>
            <Typography sx={{ color: '#475569', fontSize: 14 }}>
              {confirmSaveType === 'product'
                ? `สินค้า: ${editForm.productName || '-'}`
                : `หมวดหมู่: ${categoryForm.categoryName || '-'}`}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setConfirmSaveType('')}>
            ยกเลิก
          </Button>
          <Button
            startIcon={<Save size={18} />}
            variant="contained"
            onClick={() => {
              const saveType = confirmSaveType

              setConfirmSaveType('')
              if (saveType === 'product') {
                handleSaveProduct()
              } else if (saveType === 'category') {
                handleSaveCategory()
              }
            }}
          >
            ยืนยันบันทึก
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        fullWidth
        maxWidth="sm"
        open={Boolean(selectedRemarkProduct)}
        onClose={() => setSelectedRemarkProduct(null)}
      >
        <DialogTitle>
          {selectedRemarkType === 'product' ? 'หมายเหตุสินค้า' : 'รายละเอียด'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography sx={{ color: '#0f172a', fontSize: 16, fontWeight: 800 }}>
              {selectedRemarkProduct?.productName || '-'}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: 13 }}>
              รหัสสินค้า: {selectedRemarkProduct?.productId || '-'}
            </Typography>
            {selectedRemarkType === 'latest' ? (
              <Typography sx={{ color: '#1d4ed8', fontSize: 13, fontWeight: 800 }}>
                มาจากรายการ: {selectedRemarkProduct?.lastRemarkSource || '-'}
              </Typography>
            ) : null}
            <Box
              sx={{
                bgcolor: '#f8fafc',
                border: '1px solid #d9e0ea',
                borderRadius: 1.5,
                color: '#1f2937',
                fontSize: 15,
                lineHeight: 1.8,
                minHeight: 110,
                p: 2,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {selectedRemarkType === 'product'
                ? selectedRemarkProduct?.productRemark || '-'
                : selectedRemarkProduct?.lastRemark || '-'}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" onClick={() => setSelectedRemarkProduct(null)}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        fullWidth
        maxWidth="lg"
        open={Boolean(costLotsData)}
        onClose={() => setCostLotsData(null)}
      >
        <DialogTitle>รายละเอียดต้นทุน FIFO</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box>
              <Typography sx={{ color: '#0f172a', fontSize: 16, fontWeight: 800 }}>
                {costLotsData?.productName || '-'}
              </Typography>
              <Typography sx={{ color: '#64748b', fontSize: 13 }}>
                รหัสสินค้า: {costLotsData?.productId || '-'} | หน่วยเบิก: {costLotsData?.issueUnit || '-'}
              </Typography>
            </Box>

            <Grid container spacing={1.5}>
              <Grid size={3}>
                <Box sx={{ bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 1.5, p: 1.5 }}>
                  <Typography sx={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>จำนวนล็อตที่เหลือ</Typography>
                  <Typography sx={{ color: '#0f172a', fontSize: 22, fontWeight: 900 }}>
                    {Number(costLotsData?.totalLots ?? 0).toLocaleString('th-TH')}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={3}>
                <Box sx={{ bgcolor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 1.5, p: 1.5 }}>
                  <Typography sx={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>จำนวนคงเหลือ</Typography>
                  <Typography sx={{ color: '#0f172a', fontSize: 22, fontWeight: 900 }}>
                    {Number(costLotsData?.totalRemainingQty ?? 0).toLocaleString('th-TH')}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={3}>
                <Box sx={{ bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 1.5, p: 1.5 }}>
                  <Typography sx={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>ต้นทุนเฉลี่ยรวม/หน่วย</Typography>
                  <Typography sx={{ color: '#0f172a', fontSize: 22, fontWeight: 900 }}>
                    {Number(costLotsData?.averageUnitCost ?? 0).toLocaleString('th-TH', {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={3}>
                <Box sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 1.5, p: 1.5 }}>
                  <Typography sx={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>มูลค่าต้นทุนรวม</Typography>
                  <Typography sx={{ color: '#0f172a', fontSize: 22, fontWeight: 900 }}>
                    {Number(costLotsData?.totalRemainingCostValue ?? 0).toLocaleString('th-TH', {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Typography sx={{ color: '#0f172a', fontSize: 15, fontWeight: 800 }}>
              สรุปต้นทุนแยกตามผู้ขาย
            </Typography>
            <AppTable
              columns={[
                { key: 'supplierName', label: 'ผู้ขาย', width: 220, align: 'center' },
                { key: 'totalLots', label: 'จำนวนล็อต', width: 110, align: 'center' },
                { key: 'totalRemainingQty', label: 'จำนวนคงเหลือ', width: 130, align: 'center' },
                {
                  key: 'averageUnitCost',
                  label: 'ต้นทุนเฉลี่ย/หน่วย',
                  width: 150,
                  align: 'center',
                  render: (row) => Number(row.averageUnitCost ?? 0).toLocaleString('th-TH', {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  }),
                },
                {
                  key: 'latestUnitCost',
                  label: 'ราคาซื้อล่าสุด',
                  width: 140,
                  align: 'center',
                  render: (row) => Number(row.latestUnitCost ?? 0).toLocaleString('th-TH', {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  }),
                },
                {
                  key: 'latestReceiveDateText',
                  label: 'รับเข้าล่าสุด',
                  width: 170,
                  align: 'center',
                },
                {
                  key: 'totalRemainingCostValue',
                  label: 'มูลค่าต้นทุนรวม',
                  width: 190,
                  align: 'center',
                  render: (row) => Number(row.totalRemainingCostValue ?? 0).toLocaleString('th-TH', {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  }),
                },
              ]}
              defaultSortField="totalRemainingCostValue"
              defaultSortDirection="desc"
              isLoading={isCostLotsLoading}
              maxHeight="260px"
              noDataText="ไม่มีข้อมูลต้นทุนแยกตามผู้ขาย"
              rowKey={(row) => row.supplierId ?? row.supplierName}
              rows={costLotsData?.supplierSummaries ?? []}
              showGlobalSearch={false}
            />

            <Typography sx={{ color: '#0f172a', fontSize: 15, fontWeight: 800 }}>
              รายละเอียดล็อต FIFO
            </Typography>
            <AppTable
              columns={[
                {
                  key: 'receiveDateText',
                  label: 'วันที่รับเข้า',
                  width: 170,
                  align: 'center',
                  value: (row) => row.receiveDateText,
                  sortValue: (row) => Number(row.costLotId ?? row.detailId ?? row.headerId ?? 0),
                },
                { key: 'supplierName', label: 'ผู้ขาย', width: 190, align: 'center' },
                { key: 'originalQty', label: 'จำนวนเริ่มต้น', width: 130, align: 'center' },
                { key: 'remainingQty', label: 'จำนวนคงเหลือ', width: 130, align: 'center' },
                {
                  key: 'unitCost',
                  label: 'ต้นทุน/หน่วย',
                  width: 130,
                  align: 'center',
                  render: (row) =>
                    Number(row.unitCost ?? 0).toLocaleString('th-TH', {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    }),
                },
                {
                  key: 'remainingCostValue',
                  label: 'มูลค่าต้นทุนรวม',
                  width: 190,
                  align: 'center',
                  render: (row) =>
                    Number(row.remainingCostValue ?? 0).toLocaleString('th-TH', {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    }),
                },
              ]}
              defaultSortField="receiveDateText"
              defaultSortDirection="desc"
              isLoading={isCostLotsLoading}
              maxHeight="420px"
              noDataText="ไม่มีล็อตต้นทุนคงเหลือ"
              rowKey="costLotId"
              rows={costLotsData?.lots ?? []}
              showGlobalSearch={false}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" onClick={() => setCostLotsData(null)}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

export default ProductsPage
