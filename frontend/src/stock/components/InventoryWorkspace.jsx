import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  Barcode,
  Boxes,
  Camera,
  CheckSquare,
  FileSpreadsheet,
  PackagePlus,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Settings2,
  Star,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  createStockIssue,
  createStockReceive,
  createSupplier,
  getCategories,
  getDepartments,
  getProductFavorites,
  getProducts,
  getSuppliers,
  saveProductFavorite,
  updateSupplierStatus,
  uploadProductImage,
} from '../../api/api'
import AppTable from '../../components/common/AppTable'
import { saveIssueReport } from '../../reports/services/issueReportStorage'
import { useAuthStore } from '../../store/authStore'
import { useInventoryDraftStore } from '../../store/inventoryDraftStore'
import {
  normalizeBarcodeInput,
  normalizeDecimalNumberInput,
  normalizePlainName,
  normalizeWholeNumberInput,
} from '../../utils/inputGuards'
import './InventoryWorkspace.css'

const defaultProductForm = {
  barcode: '',
  category: '',
  code: '',
  conversionQty: '1',
  costLot: '',
  imageName: '',
  issueUnit: 'ชิ้น',
  minQty: '100',
  name: '',
  receiveHint: '',
  receiveUnit: 'แพ็ค',
  requestQty: '1',
}

const departmentSearchOptionValue = '__department_search__'

function normalizeDepartmentRow(row) {
  return {
    code: row.departmentCode ?? row.DepartmentCode ?? '',
    id: row.departmentId ?? row.DepartmentId ?? '',
    name: row.departmentName ?? row.DepartmentName ?? '',
    status: Number(row.departmentStatus ?? row.DepartmentStatus ?? 1),
  }
}

function normalizeProductRow(row) {
  const code = row.code ?? row.productId ?? row.ProductId ?? ''
  const name = row.name ?? row.productName ?? row.ProductName ?? code
  const unit = row.unit ?? row.Unit ?? 'ชิ้น'

  return {
    id: code,
    barcode: row.barcode ?? row.Barcode ?? '',
    category: row.categoryName ?? row.CategoryName ?? row.category ?? row.Category ?? 'General',
    code,
    conversionQty: Number(row.conversionQty ?? row.ConversionQty ?? row.convertQty ?? row.ConvertQty ?? 1),
    costLot: row.costLot ?? row.CostLot ?? '',
    imageName: row.imageName ?? row.ImageName ?? '',
    issueUnit: row.issueUnit ?? row.IssueUnit ?? unit,
    minQty: Number(row.minQty ?? row.MinQty ?? 10),
    name,
    receiveHint: row.receiveHint ?? row.ReceiveHint ?? '',
    receiveUnit: row.receiveUnit ?? row.ReceiveUnit ?? unit,
    requestQty: Number(row.requestQty ?? row.RequestQty ?? 1),
    stockQty: Number(row.stockQty ?? row.StockQty ?? 0),
  }
}

function toPositiveNumber(value) {
  const number = Number(value)

  return Number.isFinite(number) && number >= 0 ? number : 0
}

function normalizeCompareText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function getReceiveStockQty(item) {
  const conversionQty = shouldUseSameUnitConversion(item.unit ?? item.receiveUnit, item.issueUnit)
    ? 1
    : Math.max(toPositiveNumber(item.conversionQty), 1)

  return toPositiveNumber(item.requestQty) * conversionQty
}

function getIssueAvailableQty(item) {
  return toPositiveNumber(item.stockQty)
}

function getIssueBacklogQty(item) {
  return Math.max(toPositiveNumber(item.requestQty) - getIssueAvailableQty(item), 0)
}

function shouldUseSameUnitConversion(receiveUnit, issueUnit) {
  return String(receiveUnit ?? '').trim() && String(receiveUnit ?? '').trim() === String(issueUnit ?? '').trim()
}

function getDisplayConversionQty(item) {
  return shouldUseSameUnitConversion(item.unit ?? item.receiveUnit, item.issueUnit)
    ? 1
    : Math.max(toPositiveNumber(item.conversionQty), 1)
}

function getConversionHelperText(item) {
  const receiveQty = Number(item.requestQty ?? 0).toLocaleString('th-TH')
  const receiveUnit = item.unit ?? item.receiveUnit ?? ''
  const issueUnit = item.issueUnit ?? ''

  if (shouldUseSameUnitConversion(receiveUnit, issueUnit)) {
    return `${receiveQty} ${receiveUnit} = ${receiveQty} ${issueUnit}`
  }

  return `${receiveQty} ${receiveUnit} x ${getDisplayConversionQty(item).toLocaleString('th-TH')}`
}

function mergeIssueReportWithPayload(apiReport, payload) {
  const payloadItemsByCode = new Map(
    (payload.items ?? []).map((item) => [
      String(item.code ?? '').trim(),
      item,
    ]),
  )

  return {
    ...payload,
    ...apiReport,
    items: (apiReport.items ?? payload.items ?? []).map((item, index) => {
      const payloadItem = payloadItemsByCode.get(String(item.code ?? '').trim())

      return {
        ...payloadItem,
        ...item,
        category: String(item.category ?? payloadItem?.category ?? '').trim() || 'General',
        lineNo: item.lineNo ?? payloadItem?.lineNo ?? index + 1,
      }
    }),
  }
}

function getImageUrl(imageName) {
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

  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, '') ?? ''

  if (normalizedImageName.startsWith('/')) {
    return `${baseUrl}${normalizedImageName}`
  }

  if (normalizedImageName.startsWith('uploads/')) {
    return `${baseUrl}/${normalizedImageName}`
  }

  return `${baseUrl}/uploads/products/${normalizedImageName}`
}

const pageConfig = {
  issue: {
    actionLabel: 'บันทึกเบิกสินค้า',
    documentLabel: 'แผนก / เลขที่เอกสาร',
    emptyText: 'ยังไม่มีรายการเบิก',
    icon: PackageCheck,
    scanPlaceholder: 'สแกนหรือพิมพ์รหัสสินค้า / บาร์โค้ด',
    sideTitle: 'รายการเบิก',
    subtitle: 'เลือกสินค้า ค้นหาตามหมวดหมู่ และตัดสต๊อกตามล็อตราคาจริง',
    title: 'เบิกสินค้า',
  },
  receive: {
    actionLabel: 'บันทึกรับเข้า',
    documentLabel: 'เลขที่ PO / Invoice',
    emptyText: 'ยังไม่มีรายการรับเข้า',
    icon: Boxes,
    scanPlaceholder: 'สแกนหรือพิมพ์รหัสสินค้า / บาร์โค้ด สำหรับรับเข้า',
    sideTitle: 'รายการนำเข้า',
    subtitle: 'รับสินค้าเข้าสต๊อก แนบรูป ติ๊กเลือกรายการ และกำหนดหน่วยรับเข้า',
    title: 'นำของเข้า',
  },
}

const stockStatusOptions = [
  { label: 'พร้อมเบิก', value: 'available' },
  { label: 'ใกล้หมด', value: 'low' },
  { label: 'หมด', value: 'out' },
]

function getStockStatusValue(item) {
  if (Number(item.stockQty) <= 0) {
    return 'out'
  }

  if (Number(item.stockQty) <= Number(item.minQty)) {
    return 'low'
  }

  return 'available'
}

function InventoryWorkspace({ mode }) {
  const config = pageConfig[mode]
  const navigate = useNavigate()
  const employee = useAuthStore((state) => state.employee)
  const employeeId = employee?.id ?? employee?.employeeId ?? employee?.EmployeeId ?? 0
  const employeeName =
    employee?.employeeName
    ?? employee?.EmployeeName
    ?? employee?.name
    ?? employee?.username
    ?? employee?.Username
    ?? 'ผู้ใช้งาน'
  const [inventoryItems, setInventoryItems] = useState([])
  const [categoryOptions, setCategoryOptions] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [allSuppliers, setAllSuppliers] = useState([])
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false)
  const [isSupplierManagementOpen, setIsSupplierManagementOpen] = useState(false)
  const [supplierName, setSupplierName] = useState('')
  const [isSavingSupplier, setIsSavingSupplier] = useState(false)
  const [updatingSupplierId, setUpdatingSupplierId] = useState(null)
  const [favoriteProductCodes, setFavoriteProductCodes] = useState([])
  const [loadError, setLoadError] = useState('')
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false)
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false)
  const [isConfirmNewProductOpen, setIsConfirmNewProductOpen] = useState(false)
  const [matchedProduct, setMatchedProduct] = useState(null)
  const [missingIssueCode, setMissingIssueCode] = useState('')
  const [productForm, setProductForm] = useState(defaultProductForm)
  const [isProductFormSubmitted, setIsProductFormSubmitted] = useState(false)
  const [duplicateProductCodeAlerted, setDuplicateProductCodeAlerted] = useState('')
  const [receiveDraftItem, setReceiveDraftItem] = useState(null)
  const [departmentCodeText, setDepartmentCodeText] = useState('')
  const [departmentOptions, setDepartmentOptions] = useState([])
  const [departmentSearchText, setDepartmentSearchText] = useState('')
  const [issueDepartment, setIssueDepartment] = useState('')
  const [issueDepartmentCode, setIssueDepartmentCode] = useState('')
  const [isDepartmentSelectOpen, setIsDepartmentSelectOpen] = useState(false)
  const [scanText, setScanText] = useState('')
  const [searchText, setSearchText] = useState('')
  const [category, setCategory] = useState('')
  const [stockStatus, setStockStatus] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const selectedItems = useInventoryDraftStore((state) => state.selectedItemsByMode[mode] ?? [])
  const isReceiveSupplierLocked = mode === 'receive'
    && selectedItems.length > 0
    && Boolean(selectedSupplierId)
  const updateSelectedItems = useInventoryDraftStore((state) => state.setSelectedItems)
  const setSelectedItems = useCallback(
    (updater) => updateSelectedItems(mode, updater),
    [mode, updateSelectedItems],
  )
  const categories = useMemo(() => {
    const names = [
      ...categoryOptions.map((item) => item.categoryName),
      ...inventoryItems.map((item) => item.category),
      'General',
    ]

    return [...new Set(names.map((name) => String(name ?? '').trim()).filter(Boolean))]
  }, [categoryOptions, inventoryItems])
  const productFormImageUrl = getImageUrl(productForm.imageName)
  const productFormConversionQty = shouldUseSameUnitConversion(productForm.receiveUnit, productForm.issueUnit)
    ? 1
    : toPositiveNumber(productForm.conversionQty)
  const productFormStockQty = toPositiveNumber(productForm.requestQty) * productFormConversionQty
  const existingProductByCode = inventoryItems.find(
    (item) => normalizeCompareText(item.code) === normalizeCompareText(productForm.code),
  )
  const existingProductByBarcode = productForm.barcode.trim()
    ? inventoryItems.find(
      (item) => normalizeCompareText(item.barcode) === normalizeCompareText(productForm.barcode),
    )
    : null
  const existingDuplicateProduct = existingProductByCode || existingProductByBarcode
  const duplicateProductField = existingProductByCode ? 'code' : existingProductByBarcode ? 'barcode' : ''
  const filteredDepartmentOptions = useMemo(() => {
    const keyword = departmentSearchText.trim().toLowerCase()

    if (!keyword) {
      return departmentOptions
    }

    return departmentOptions.filter((department) =>
      `${department.code} ${department.name}`.toLowerCase().includes(keyword),
    )
  }, [departmentOptions, departmentSearchText])

  const loadInventoryItems = useCallback(async () => {
    setLoadError('')

    try {
      const products = await getProducts()

      setInventoryItems((products ?? []).map(normalizeProductRow))
    } catch {
      setLoadError('โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาตรวจสอบว่า Backend API เปิดอยู่')
      setInventoryItems([])
    }
  }, [])

  const loadDepartments = useCallback(async () => {
    if (mode !== 'issue') {
      return
    }

    try {
      const departments = await getDepartments()

      setDepartmentOptions((departments ?? []).map(normalizeDepartmentRow).filter((department) => department.status === 1))
    } catch {
      setDepartmentOptions([])
    }
  }, [mode])

  const loadCategories = useCallback(async () => {
    try {
      const categoryRows = await getCategories()

      setCategoryOptions(
        (categoryRows ?? [])
          .map((row) => ({
            categoryId: row.categoryId ?? row.CategoryId ?? '',
            categoryName: row.categoryName ?? row.CategoryName ?? '',
            categoryStatus: Number(row.categoryStatus ?? row.CategoryStatus ?? 1),
          }))
          .filter((item) => item.categoryStatus === 1 && item.categoryName),
      )
    } catch {
      setCategoryOptions([])
    }
  }, [])

  const loadSuppliers = useCallback(async () => {
    if (mode !== 'receive') {
      return
    }

    try {
      const rows = await getSuppliers()
      const supplierRows = rows ?? []
      setAllSuppliers(supplierRows)
      setSuppliers(supplierRows.filter((supplier) => Number(supplier.supplierStatus ?? 1) === 1))
    } catch {
      setSuppliers([])
      setAllSuppliers([])
    }
  }, [mode])

  useEffect(() => {
    loadInventoryItems()
  }, [loadInventoryItems])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  useEffect(() => {
    loadDepartments()
  }, [loadDepartments])

  const selectIssueDepartment = (department) => {
    setDepartmentCodeText(department.code)
    setIssueDepartment(department.name)
    setIssueDepartmentCode(department.code)
  }

  const clearIssueDepartment = () => {
    setDepartmentCodeText('')
    setDepartmentSearchText('')
    setIssueDepartment('')
    setIssueDepartmentCode('')
  }

  const handleDepartmentCodeCheck = () => {
    const code = normalizeBarcodeInput(departmentCodeText).trim()

    if (!code) {
      return
    }

    const department = departmentOptions.find(
      (item) => item.code.toUpperCase() === code.toUpperCase(),
    )

    if (!department) {
      setIssueDepartment('')
      setIssueDepartmentCode('')
      toast.error('ไม่พบรหัสแผนกนี้')
      return
    }

    selectIssueDepartment(department)
    toast.success(`เลือกแผนก ${department.name}`)
  }

  const handleDepartmentCodeKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleDepartmentCodeCheck()
    }
  }

  const handleDepartmentSelect = (departmentCode) => {
    if (departmentCode === departmentSearchOptionValue) {
      return
    }

    if (!departmentCode) {
      clearIssueDepartment()
      setIsDepartmentSelectOpen(false)
      return
    }

    const department = departmentOptions.find((item) => item.code === departmentCode)

    if (department) {
      selectIssueDepartment(department)
      setDepartmentSearchText('')
      setIsDepartmentSelectOpen(false)
    }
  }

  const handleSelectedItemChange = useCallback((itemId, field, value) => {
    const nextValue = field === 'requestQty'
      ? normalizeWholeNumberInput(value)
      : field === 'unit'
        ? normalizePlainName(value)
        : value

    setSelectedItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: nextValue,
            }
          : item,
      ),
    )
  }, [setSelectedItems])

  const createSelectedItem = (item) => {
    const unit = mode === 'receive' ? item.receiveUnit : item.issueUnit
    const conversionQty = shouldUseSameUnitConversion(unit, item.issueUnit) ? 1 : (item.conversionQty ?? 1)

    return {
      ...item,
      conversionQty,
      costLot: item.costLot ?? '',
      imageName: item.imageName ?? '',
      requestQty: item.requestQty ?? 1,
      unitCost: '',
      unit,
    }
  }

  const handleOpenReceiveDialog = (item) => {
    const existingItem = selectedItems.find((selected) => selected.id === item.id)

    const draftItem = existingItem ? { ...existingItem } : createSelectedItem(item)

    setReceiveDraftItem({
      ...draftItem,
      conversionQty: shouldUseSameUnitConversion(draftItem.unit, draftItem.issueUnit)
        ? 1
        : draftItem.conversionQty,
    })
  }

  const handleReceiveDraftChange = (field, value) => {
    const nextValue = field === 'requestQty' || field === 'conversionQty'
      ? normalizeWholeNumberInput(value)
      : field === 'unitCost'
        ? normalizeDecimalNumberInput(value)
        : field === 'unit' || field === 'issueUnit'
          ? normalizePlainName(value)
          : value

    setReceiveDraftItem((current) => {
      if (!current) {
        return current
      }

      const next = {
        ...current,
        [field]: nextValue,
      }

        if (shouldUseSameUnitConversion(next.unit, next.issueUnit)) {
          next.conversionQty = '1'
        }

      return next
    })
  }

  const handleSaveReceiveDraft = () => {
    if (!receiveDraftItem) {
      return
    }

    if (!selectedSupplierId) {
      toast.error('กรุณาเลือกผู้ขายก่อนเพิ่มรายการรับเข้า')
      return
    }

    setSelectedItems((current) => [
      {
        ...receiveDraftItem,
      },
      ...current.filter((item) => item.id !== receiveDraftItem.id),
    ])
    setReceiveDraftItem(null)
  }

  const handleRemoveSelectedItem = useCallback((event, itemId) => {
    event.stopPropagation()
    setSelectedItems((current) => current.filter((item) => item.id !== itemId))
  }, [setSelectedItems])

  const selectedTableColumns = useMemo(() => {
    const numberInputSx = {
      '& input': {
        p: '6px 8px',
        textAlign: 'right',
      },
    }
    const textInputSx = {
      '& input': {
        p: '6px 8px',
        textAlign: 'center',
      },
    }

    const baseColumns = [
      { key: 'code', label: 'รหัสสินค้า', width: 150, sortable: false },
      { key: 'name', label: 'ชื่อสินค้า', width: 220, sortable: false },
      { key: 'category', label: 'หมวดหมู่', width: 120, sortable: false },
    ]
    const quantityColumns = [
      {
        key: 'requestQty',
        label: mode === 'receive' ? 'จำนวนรับเข้า' : 'จำนวน',
        width: 110,
        sortable: false,
        render: (row) => (
          <TextField
            fullWidth
            size="small"
            type="number"
            value={row.requestQty}
            onChange={(event) => handleSelectedItemChange(row.id, 'requestQty', event.target.value)}
            sx={numberInputSx}
          />
        ),
      },
      {
        key: 'unit',
        label: mode === 'receive' ? 'หน่วยรับเข้า' : 'หน่วยเบิก',
        width: 130,
        sortable: false,
        render: (row) => (
          <TextField
            disabled={mode === 'issue'}
            fullWidth
            size="small"
            value={row.unit}
            onChange={(event) => handleSelectedItemChange(row.id, 'unit', event.target.value)}
            sx={textInputSx}
          />
        ),
      },
    ]

    if (mode === 'receive') {
      return [
        {
          key: 'actions',
          label: 'จัดการ',
          width: 120,
          align: 'center',
          sortable: false,
          render: (row) => (
            <Stack direction="row" justifyContent="center" spacing={0.5}>
              <IconButton size="small" onClick={() => setReceiveDraftItem({ ...row })}>
                <Pencil size={16} />
              </IconButton>
              <IconButton color="error" size="small" onClick={(event) => handleRemoveSelectedItem(event, row.id)}>
                <Trash2 size={16} />
              </IconButton>
            </Stack>
          ),
        },
        {
          key: 'name',
          label: 'ชื่อสินค้า',
          width: 230,
          sortable: false,
        },
        {
          key: 'requestQty',
          label: 'จำนวนรับเข้า',
          width: 120,
          align: 'center',
          sortable: false,
          render: (row) => `${Number(row.requestQty ?? 0).toLocaleString('th-TH')} ${row.unit}`,
        },
        {
          key: 'unitCost',
          label: 'ราคาซื้อ',
          width: 120,
          align: 'center',
          sortable: false,
          render: (row) => Number(row.unitCost ?? 0).toLocaleString('th-TH'),
        },
        {
          key: 'stockAddQty',
          label: 'เพิ่มสต๊อก',
          width: 140,
          align: 'center',
          sortable: false,
          value: (row) => getReceiveStockQty(row),
          render: (row) => (
            <Typography sx={{ color: '#0f172a', fontSize: 13, fontWeight: 800 }}>
              {getReceiveStockQty(row).toLocaleString('th-TH')} {row.issueUnit}
            </Typography>
          ),
        },
        { key: 'code', label: 'รหัสสินค้า', width: 150, sortable: false },
      ]
    }

    return [
      ...quantityColumns,
      {
        key: 'availableQty',
        label: 'คงเหลือ',
        width: 110,
        align: 'center',
        sortable: false,
        render: (row) => `${getIssueAvailableQty(row).toLocaleString('th-TH')} ${row.unit ?? ''}`,
      },
      {
        key: 'backlogQty',
        label: 'ค้าง',
        width: 110,
        align: 'center',
        sortable: false,
        render: (row) => {
          const backlogQty = getIssueBacklogQty(row)

          return backlogQty > 0 ? (
            <Chip color="warning" label={`${backlogQty.toLocaleString('th-TH')} ${row.unit ?? ''}`} size="small" />
          ) : (
            '-'
          )
        },
      },
      ...baseColumns,
    ]
  }, [handleRemoveSelectedItem, handleSelectedItemChange, mode])

  useEffect(() => {
    let isMounted = true

    const loadFavorites = async () => {
      if (!employeeId) {
        return
      }

      try {
        const favorites = await getProductFavorites({
          employeeId,
          mode,
        })

        if (isMounted) {
          setFavoriteProductCodes(favorites.map((favorite) => favorite.productCode))
        }
      } catch {
        // Keep local favorites if the API is not ready yet.
      }
    }

    loadFavorites()

    return () => {
      isMounted = false
    }
  }, [employeeId, mode])

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()

    return inventoryItems
      .map((item) => ({
        ...item,
        isFavorite: favoriteProductCodes.includes(item.code),
      }))
      .filter((item) => (category ? item.category === category : true))
      .filter((item) => (stockStatus ? getStockStatusValue(item) === stockStatus : true))
      .filter((item) => (favoriteOnly ? item.isFavorite : true))
      .filter((item) =>
        keyword
          ? [item.code, item.name, item.barcode, item.category]
              .some((value) => String(value ?? '').toLowerCase().includes(keyword))
          : true,
      )
      .sort((firstItem, secondItem) => Number(secondItem.isFavorite) - Number(firstItem.isFavorite))
  }, [category, favoriteOnly, favoriteProductCodes, inventoryItems, searchText, stockStatus])

  const canSubmit =
    selectedItems.length > 0
    && (mode !== 'issue' || issueDepartment.trim())
    && (mode !== 'receive' || Boolean(selectedSupplierId))
    && (mode === 'issue'
      || selectedItems.every(
        (item) =>
          toPositiveNumber(item.requestQty) > 0
          && toPositiveNumber(item.conversionQty) > 0
          && item.unitCost !== ''
          && item.unitCost !== null
          && item.unitCost !== undefined,
      ))

  const handleToggleItem = (item) => {
    if (mode === 'receive') {
      handleOpenReceiveDialog(item)
      return
    }

    setSelectedItems((current) =>
      current.some((selected) => selected.id === item.id)
        ? current.filter((selected) => selected.id !== item.id)
        : [...current, createSelectedItem(item)],
    )
  }

  const handleSaveScanQueue = () => {
    const scanCode = normalizeBarcodeInput(scanText).trim()

    if (!scanCode) {
      return
    }

    const matchedItem = inventoryItems.find((item) =>
      [item.code, item.barcode].some(
        (value) => String(value ?? '').toUpperCase() === scanCode.toUpperCase(),
      ),
    )

    if (matchedItem) {
      if (mode === 'receive') {
        handleOpenReceiveDialog(matchedItem)
        setScanText('')
        return
      }

      setSelectedItems((current) => {
        const existingItem = current.find((item) => item.id === matchedItem.id)

        if (!existingItem) {
          return [createSelectedItem(matchedItem), ...current]
        }

        return current.map((item) =>
          item.id === matchedItem.id
            ? {
                ...item,
                requestQty: toPositiveNumber(item.requestQty) + toPositiveNumber(matchedItem.requestQty || 1),
              }
            : item,
        )
      })
      setMatchedProduct({
        ...matchedItem,
        isFavorite: favoriteProductCodes.includes(matchedItem.code),
      })
    } else if (mode === 'receive') {
      handleOpenNewProduct(scanCode)
    } else {
      setMissingIssueCode(scanCode)
    }

    setScanText('')
  }

  const handleScanKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSaveScanQueue()
    }
  }

  const handleToggleFavorite = async (event, item) => {
    event.stopPropagation()

    const productCode = item.code
    const nextIsFavorite = !favoriteProductCodes.includes(productCode)

    setFavoriteProductCodes((current) =>
      nextIsFavorite
        ? [...new Set([productCode, ...current])]
        : current.filter((code) => code !== productCode),
    )

    if (!employeeId) {
      return
    }

    try {
      await saveProductFavorite({
        employeeId,
        isFavorite: nextIsFavorite,
        mode,
        productCode,
      })
    } catch {
      setFavoriteProductCodes((current) =>
        nextIsFavorite
          ? current.filter((code) => code !== productCode)
          : [...new Set([productCode, ...current])],
      )
    }
  }

  const productFormErrors = {
    barcode: Boolean(existingProductByBarcode),
    category: !productForm.category.trim(),
    code: !productForm.code.trim() || Boolean(existingProductByCode),
    conversionQty: toPositiveNumber(productForm.conversionQty) <= 0,
    costLot: !productForm.costLot.trim(),
    imageName: !productForm.imageName,
    issueUnit: !productForm.issueUnit.trim(),
    minQty: productForm.minQty === '' || productForm.minQty === null || productForm.minQty === undefined,
    name: !productForm.name.trim(),
    receiveUnit: !productForm.receiveUnit.trim(),
    requestQty: toPositiveNumber(productForm.requestQty) <= 0,
  }
  const canSaveNewProduct =
    !Object.values(productFormErrors).some(Boolean)
    && Boolean(selectedSupplierId)
  const canOpenNewProductConfirm =
    canSaveNewProduct || (Boolean(existingDuplicateProduct) && !Object.entries(productFormErrors).some(([field, hasError]) => field !== duplicateProductField && hasError))

  const getProductFieldErrorProps = (field, helperText) => ({
    error:
      (isProductFormSubmitted && productFormErrors[field])
      || (field === duplicateProductField
        && Boolean(existingDuplicateProduct)
        && normalizeCompareText(duplicateProductCodeAlerted) === normalizeCompareText(productForm[field])),
    helperText:
      field === duplicateProductField
        && existingDuplicateProduct
        && normalizeCompareText(duplicateProductCodeAlerted) === normalizeCompareText(productForm[field])
        ? field === 'barcode'
          ? 'บาร์โค้ดนี้มีอยู่แล้วในระบบ'
          : 'รหัสสินค้านี้มีอยู่แล้วในระบบ'
        : isProductFormSubmitted && productFormErrors[field]
        ? field === 'barcode' && existingProductByBarcode
          ? 'บาร์โค้ดนี้มีอยู่แล้วในระบบ'
          : field === 'code' && existingProductByCode
            ? 'รหัสสินค้านี้มีอยู่แล้วในระบบ'
          : 'กรุณากรอกข้อมูลช่องนี้'
        : helperText,
  })

  const handleDuplicateProductCheck = (field, value = productForm[field]) => {
    const nextValue = normalizeBarcodeInput(value)
    const matchedDuplicateProduct = inventoryItems.find(
      (item) => normalizeCompareText(item[field]) === normalizeCompareText(nextValue),
    )

    if (
      nextValue.trim()
      && matchedDuplicateProduct
        && normalizeCompareText(duplicateProductCodeAlerted) !== normalizeCompareText(nextValue)
      ) {
        setDuplicateProductCodeAlerted(nextValue)
        setIsConfirmNewProductOpen(true)
      return true
    }

    if (!matchedDuplicateProduct) {
      setDuplicateProductCodeAlerted('')
    }

    return false
  }

  const handleProductFormChange = (field, value) => {
    const nextValue = field === 'code' || field === 'barcode'
      ? normalizeBarcodeInput(value)
      : field === 'requestQty' || field === 'conversionQty' || field === 'minQty'
        ? normalizeWholeNumberInput(value)
        : field === 'costLot'
          ? normalizeDecimalNumberInput(value)
          : field === 'name' || field === 'category' || field === 'receiveUnit' || field === 'issueUnit'
            ? normalizePlainName(value)
            : value

    if (
      (field === 'code' || field === 'barcode')
      && normalizeCompareText(duplicateProductCodeAlerted) !== normalizeCompareText(nextValue)
    ) {
      setDuplicateProductCodeAlerted('')
    }

    setProductForm((current) => {
      const next = {
        ...current,
        [field]: nextValue,
      }

      if (
        (field === 'receiveUnit' || field === 'issueUnit')
        && shouldUseSameUnitConversion(next.receiveUnit, next.issueUnit)
      ) {
        next.conversionQty = '1'
      }

      return next
    })
  }

  const handleOpenNewProduct = (initialCode = scanText.trim()) => {
    const normalizedInitialCode = typeof initialCode === 'string' ? initialCode : scanText.trim()

    setProductForm({
      ...defaultProductForm,
      barcode: normalizedInitialCode,
      code: normalizedInitialCode,
    })
    setIsProductFormSubmitted(false)
    setDuplicateProductCodeAlerted('')
    setIsProductDialogOpen(true)
  }

  const handleAttachProductImage = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const uploadedImage = await uploadProductImage(file)

      handleProductFormChange('imageName', uploadedImage.url ?? uploadedImage.Url ?? '')
      toast.success('อัปโหลดรูปสินค้าสำเร็จ')
    } catch {
      toast.error('อัปโหลดรูปสินค้าไม่สำเร็จ กรุณาตรวจสอบ Backend API')
    } finally {
      event.target.value = ''
    }
  }

  const handleSaveNewProduct = async () => {
    if (!canSaveNewProduct) {
      setIsProductFormSubmitted(true)
      return
    }

    if (existingDuplicateProduct) {
      return
    }

    const newItem = {
      id: productForm.code.trim(),
      barcode: productForm.barcode.trim(),
      category: productForm.category.trim(),
      code: productForm.code.trim(),
      conversionQty: productFormConversionQty || 1,
      costLot: productForm.costLot.trim(),
      imageName: productForm.imageName,
      isFavorite: false,
      issueUnit: productForm.issueUnit.trim(),
      minQty: Number(productForm.minQty) || 0,
      name: productForm.name.trim(),
      receiveHint:
        productForm.receiveHint.trim() ||
        `1 ${productForm.receiveUnit.trim()} = ${productFormConversionQty || 1} ${productForm.issueUnit.trim()}`,
      receiveUnit: productForm.receiveUnit.trim(),
      requestQty: Number(productForm.requestQty) || 1,
      stockQty: 0,
    }

    setSelectedItems((current) => [
      ...current.filter((item) => item.id !== newItem.id),
      {
        ...newItem,
        requestQty: toPositiveNumber(newItem.requestQty) || 1,
        unit: newItem.receiveUnit,
        unitCost: newItem.costLot,
      },
    ])

    setIsProductDialogOpen(false)
    setIsProductFormSubmitted(false)
    setDuplicateProductCodeAlerted('')
    setSearchText('')
    setCategory('')
    toast.success('เพิ่มเข้ารายการนำเข้าแล้ว กรุณากดบันทึกรับเข้าเพื่อยืนยัน')
  }

  const createTransactionPayload = (documentNo, createdAt) => ({
    createdAt: createdAt.toISOString(),
    department: mode === 'issue' ? issueDepartment.trim() : '',
    documentNo,
    employeeId,
    employeeName,
    supplierId: mode === 'receive' && selectedSupplierId ? Number(selectedSupplierId) : null,
    items: selectedItems.map((item, index) => ({
      barcode: item.barcode ?? '',
      category: String(item.category ?? '').trim() || 'General',
      code: item.code ?? '',
      conversionQty: mode === 'receive'
        ? (
            shouldUseSameUnitConversion(item.unit ?? item.receiveUnit, item.issueUnit)
              ? 1
              : toPositiveNumber(item.conversionQty)
          )
        : 1,
      costLot: mode === 'receive' ? String(item.unitCost ?? '') : String(item.costLot ?? ''),
      imageName: item.imageName ?? '',
      lineNo: index + 1,
      minQty: toPositiveNumber(item.minQty),
      productName: item.name ?? '',
      quantity: mode === 'receive' ? getReceiveStockQty(item) : toPositiveNumber(item.requestQty),
      receiveQuantity: mode === 'receive' ? toPositiveNumber(item.requestQty) : null,
      receiveUnit: mode === 'receive' ? (item.unit ?? '') : '',
      stockQty: toPositiveNumber(item.stockQty),
      unit: mode === 'receive' ? (item.issueUnit ?? '') : (item.unit ?? ''),
    })),
  })

  const handleSubmitTransaction = async () => {
    if (!canSubmit) {
      return
    }

    setIsConfirmSaveOpen(false)

    const now = new Date()
    const documentPrefix = mode === 'receive' ? 'RC' : 'IS'
    const documentNo = `${documentPrefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate(),
    ).padStart(2, '0')}-${String(now.getTime()).slice(-5)}`
    const totalQty = selectedItems.reduce(
      (total, item) => total + (mode === 'receive' ? getReceiveStockQty(item) : toPositiveNumber(item.requestQty)),
      0,
    )
    const transactionPayload = {
      ...createTransactionPayload(documentNo, now),
      status: 'สำเร็จ',
      totalItems: selectedItems.length,
      totalQty,
    }

    if (mode === 'receive') {
      try {
        await createStockReceive(transactionPayload)
        setSelectedItems([])
        setSelectedSupplierId('')
        await loadInventoryItems()
        toast.dismiss()
        await Swal.fire({
          title: 'สำเร็จ',
          text: 'บันทึกรับเข้าสำเร็จ',
          icon: 'success',
          customClass: {
            container: 'stock-swal-container',
          },
          confirmButtonText: 'ตกลง',
        })
      } catch {
        await Swal.fire({
          title: 'ไม่สำเร็จ',
          text: 'บันทึกรับเข้าไม่สำเร็จ กรุณาตรวจสอบ Backend API',
          icon: 'error',
          customClass: {
            container: 'stock-swal-container',
          },
          confirmButtonText: 'ตกลง',
        })
      }

      return
    }

    try {
      const savedStockIssue = await createStockIssue(transactionPayload)
      const issueReport = mergeIssueReportWithPayload(savedStockIssue, transactionPayload)

      saveIssueReport(issueReport)
      setSelectedItems([])
      setDepartmentCodeText('')
      setIssueDepartment('')
      setIssueDepartmentCode('')
      await loadInventoryItems()
      toast.dismiss()
      await Swal.fire({
        title: 'สำเร็จ',
        text: 'บันทึกเบิกสินค้าสำเร็จ',
        icon: 'success',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
      navigate(`/history?documentNo=${encodeURIComponent(issueReport.documentNo)}`)
    } catch {
      saveIssueReport(transactionPayload)
      await Swal.fire({
        title: 'ไม่สำเร็จ',
        text: 'บันทึกลงฐานข้อมูลไม่สำเร็จ ระบบเก็บรายการไว้ในเครื่องชั่วคราว',
        icon: 'error',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
      setSelectedItems([])
      setDepartmentCodeText('')
      setIssueDepartment('')
      setIssueDepartmentCode('')
      navigate(`/history?documentNo=${encodeURIComponent(documentNo)}`)
    }
  }

  const handleCreateSupplier = async () => {
    const normalizedName = normalizePlainName(supplierName)

    if (!normalizedName) {
      toast.error('กรุณาระบุชื่อผู้ขาย')
      return
    }

    setIsSavingSupplier(true)

    try {
      const createdSupplier = await createSupplier({ supplierName: normalizedName })
      await loadSuppliers()
      setSelectedSupplierId(String(createdSupplier.supplierId))
      setSupplierName('')
      setIsSupplierDialogOpen(false)
      toast.success('เพิ่มผู้ขายสำเร็จ')
    } catch (error) {
      toast.error(error?.response?.data ?? 'เพิ่มผู้ขายไม่สำเร็จ')
    } finally {
      setIsSavingSupplier(false)
    }
  }

  const handleSupplierStatusChange = async (supplier) => {
    const nextStatus = Number(supplier.supplierStatus ?? 1) === 1 ? 0 : 1
    const actionLabel = nextStatus === 0 ? 'ยกเลิกผู้ขาย' : 'เปิดใช้งานผู้ขาย'

    const result = await Swal.fire({
      title: actionLabel,
      text: nextStatus === 0
        ? `ผู้ขาย “${supplier.supplierName}” จะไม่ปรากฏในรายการเลือกตอนรับสินค้าใหม่ แต่ประวัติเดิมจะยังอยู่`
        : `ต้องการเปิดใช้งานผู้ขาย “${supplier.supplierName}” อีกครั้งหรือไม่`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      customClass: { container: 'stock-swal-container' },
    })

    if (!result.isConfirmed) return

    setUpdatingSupplierId(supplier.supplierId)
    try {
      await updateSupplierStatus(supplier.supplierId, nextStatus)
      await loadSuppliers()
      if (nextStatus === 0 && String(supplier.supplierId) === selectedSupplierId) {
        setSelectedSupplierId('')
      }
      toast.success(nextStatus === 0 ? 'ยกเลิกผู้ขายแล้ว' : 'เปิดใช้งานผู้ขายแล้ว')
    } catch (error) {
      toast.error(error?.response?.data ?? 'บันทึกสถานะผู้ขายไม่สำเร็จ')
    } finally {
      setUpdatingSupplierId(null)
    }
  }

  return (
    <>
    <Box className="inventory-workspace">
      <Box className="inventory-workspace__header">
        <Box>
          <Typography className="inventory-workspace__title">
            {config.title}
          </Typography>
          <Typography className="inventory-workspace__subtitle">
            {config.subtitle}
          </Typography>
        </Box>
        <Button
          startIcon={<FileSpreadsheet size={18} />}
          sx={{ fontWeight: 700, minHeight: 40 }}
          variant="outlined"
        >
          ส่งออก Excel
        </Button>
      </Box>

      {loadError ? <Alert severity="error">{loadError}</Alert> : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={2}>
            <Card className="inventory-workspace__toolbar-card" elevation={0}>
              <CardContent sx={{ p: 2 }}>
                {mode === 'issue' ? (
                  <TextField
                    autoFocus
                    fullWidth
                    placeholder={config.scanPlaceholder}
                    size="small"
                    value={scanText}
                    onChange={(event) => setScanText(normalizeBarcodeInput(event.target.value))}
                    onKeyDown={handleScanKeyDown}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Barcode color="#64748b" size={18} />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                ) : (
                  <>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField fullWidth label={config.documentLabel} size="small" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        disabled={isReceiveSupplierLocked}
                        select
                        fullWidth
                        label="ผู้ขาย *"
                        size="small"
                        value={selectedSupplierId}
                        onChange={(event) => setSelectedSupplierId(event.target.value)}
                        helperText={
                          isReceiveSupplierLocked
                            ? 'ผู้ขายถูกกำหนดแล้วสำหรับใบรับเข้ารอบนี้'
                            : 'เลือกผู้ขายเพื่อบันทึกราคาและแยกต้นทุนของแต่ละเจ้า'
                        }
                      >
                        <MenuItem value="">เลือกผู้ขาย</MenuItem>
                        {suppliers.map((supplier) => (
                          <MenuItem key={supplier.supplierId} value={String(supplier.supplierId)}>
                            {supplier.supplierName}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      autoFocus
                      fullWidth
                      placeholder={config.scanPlaceholder}
                      size="small"
                      value={scanText}
                      onChange={(event) => setScanText(normalizeBarcodeInput(event.target.value))}
                      onKeyDown={handleScanKeyDown}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Barcode color="#64748b" size={18} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                    </Grid>
                  </Grid>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 1 }}>
                    <Button
                      size="small"
                      startIcon={<Settings2 size={16} />}
                      onClick={() => setIsSupplierManagementOpen(true)}
                    >
                      จัดการผู้ขาย
                    </Button>
                    <Button size="small" startIcon={<Plus size={16} />} onClick={() => setIsSupplierDialogOpen(true)}>
                      เพิ่มผู้ขาย
                    </Button>
                  </Box>
                  </>
                )}
                <Stack
                  className="inventory-workspace__scan-actions"
                  direction="row"
                  spacing={1}
                >
                  <Typography className="inventory-workspace__scan-help">
                    ยิง QR/Barcode แล้วกด Enter ระบบจะแสดงรายละเอียดสินค้าทันที
                  </Typography>
                  <Button
                    disabled={!scanText.trim()}
                    startIcon={<Barcode size={17} />}
                    sx={{ fontWeight: 800, minHeight: 36 }}
                    variant="outlined"
                    onClick={handleSaveScanQueue}
                  >
                    ตรวจสอบสินค้า
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card className="inventory-workspace__toolbar-card" elevation={0}>
              <CardContent sx={{ p: 2 }}>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      placeholder="ค้นหาสินค้า / บาร์โค้ด / รหัสสินค้า"
                      size="small"
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search color="#64748b" size={18} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 2.5 }}>
                    <TextField
                      fullWidth
                      select
                      label="หมวดหมู่"
                      size="small"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      <MenuItem value="">ทั้งหมด</MenuItem>
                      {categories.map((item) => (
                        <MenuItem key={item} value={item}>
                          {item}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 6, md: 2.5 }}>
                    <TextField
                      fullWidth
                      select
                      label="สถานะ"
                      size="small"
                      value={stockStatus}
                      onChange={(event) => setStockStatus(event.target.value)}
                    >
                      <MenuItem value="">ทั้งหมด</MenuItem>
                      {stockStatusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: mode === 'receive' ? 6 : 12, md: mode === 'receive' ? 1.5 : 3 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={favoriteOnly}
                          icon={<Star size={18} />}
                          checkedIcon={<Star fill="#f59e0b" size={18} />}
                          onChange={(event) => setFavoriteOnly(event.target.checked)}
                        />
                      }
                      label="โปรด"
                    />
                  </Grid>
                  {mode === 'receive' ? (
                    <Grid size={{ xs: 6, md: 1.5 }}>
                      <Button
                        fullWidth
                        startIcon={<Plus size={18} />}
                        sx={{ minHeight: 40, fontWeight: 700 }}
                        variant="contained"
                        onClick={handleOpenNewProduct}
                      >
                        เพิ่ม
                      </Button>
                    </Grid>
                  ) : null}
                </Grid>
              </CardContent>
            </Card>

            <Box className="inventory-workspace__product-area">
              <Box className="inventory-workspace__product-grid">
                {filteredItems.map((item) => {
                  const imageUrl = getImageUrl(item.imageName)
                  const selectedItem = selectedItems.find((selected) => selected.id === item.id)
                  const isSelected = Boolean(selectedItem)
                  const isLowStock = item.stockQty <= item.minQty
                  const isOutOfStock = item.stockQty <= 0

                  return (
                    <Card
                      className="inventory-workspace__product-card"
                      key={item.id}
                      elevation={0}
                      onClick={() => handleToggleItem(item)}
                      sx={{
                        border: mode === 'issue' && isSelected ? '2px solid #2563eb' : '1px solid #d9e0ea',
                        cursor: 'pointer',
                      }}
                    >
                      <CardContent sx={{ p: 1.25 }}>
                        <Stack spacing={0.75}>
                          <Box
                            className={[
                              'inventory-workspace__product-image',
                              mode === 'issue' && isSelected
                                ? 'inventory-workspace__product-image--selected'
                                : 'inventory-workspace__product-image--normal',
                            ].join(' ')}
                          >
                            <IconButton
                              className="inventory-workspace__favorite-button"
                              size="small"
                              onClick={(event) => handleToggleFavorite(event, item)}
                            >
                              <Star
                                color={item.isFavorite ? '#f59e0b' : '#94a3b8'}
                                fill={item.isFavorite ? '#f59e0b' : 'none'}
                                size={18}
                              />
                            </IconButton>
                            {imageUrl ? (
                              <Box
                                alt={item.name}
                                className="inventory-workspace__product-photo"
                                component="img"
                                src={imageUrl}
                              />
                            ) : (
                              <Camera color={isSelected ? '#2563eb' : '#94a3b8'} size={28} />
                            )}
                          </Box>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography sx={{ fontSize: 13, fontWeight: 800, lineHeight: 1.25 }}>
                              {item.name}
                            </Typography>
                            <Checkbox checked={isSelected} size="small" />
                          </Stack>
                          <Typography sx={{ color: '#64748b', fontSize: 12, lineHeight: 1.2 }}>
                            {item.code}
                          </Typography>
                          <Stack direction="row" flexWrap="wrap" gap={0.75}>
                            <Chip label={item.category} size="small" />
                            {item.isFavorite ? <Chip color="warning" label="โปรด" size="small" /> : null}
                            {isOutOfStock ? (
                              <Chip color="error" label="ของหมด" size="small" />
                            ) : isLowStock ? (
                              <Chip color="error" label="ใกล้หมด" size="small" />
                            ) : (
                              <Chip color="success" label="พร้อมเบิก" size="small" />
                            )}
                          </Stack>
                          <Typography sx={{ color: '#475569', fontSize: 12, lineHeight: 1.2 }}>
                            {mode === 'receive' && selectedItem
                              ? `รอรับเข้า ${getReceiveStockQty(selectedItem).toLocaleString('th-TH')} ${selectedItem.issueUnit}`
                              : `คงเหลือ ${item.stockQty} ${item.issueUnit} | เตือนใกล้หมด ${item.minQty}`}
                          </Typography>
                          <Button
                            color={mode === 'issue' && isSelected ? 'inherit' : 'primary'}
                            disabled={mode === 'receive' && isSelected}
                            fullWidth
                            size="small"
                            startIcon={mode === 'issue' && isSelected ? <CheckSquare size={15} /> : null}
                            variant={mode === 'issue' && isSelected ? 'outlined' : 'contained'}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleToggleItem(item)
                            }}
                          >
                            {mode === 'receive'
                              ? selectedItem
                                ? 'เพิ่มในรายการแล้ว'
                                : 'เลือกสินค้า'
                              : isSelected
                                ? 'เลือกแล้ว'
                                : 'เลือกสินค้า'}
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  )
                })}
              </Box>
            </Box>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2}>
            <Card className="inventory-workspace__panel-card" elevation={0}>
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack className="inventory-workspace__selected-header" direction="row">
                    <Typography sx={{ color: '#111827', fontSize: 15, fontWeight: 800 }}>
                      {config.sideTitle}
                    </Typography>
                    <Chip label={`${selectedItems.length} รายการ`} size="small" />
                  </Stack>

                  {mode === 'receive' ? (
                    <Stack className="inventory-workspace__receive-summary-list" spacing={1}>
                      {selectedItems.length === 0 ? (
                        <Box className="inventory-workspace__receive-empty">
                          เลือกสินค้าแล้วกรอกข้อมูลรับเข้าใน popup
                        </Box>
                      ) : (
                        selectedItems.map((item) => (
                          <Box className="inventory-workspace__receive-summary-item" key={item.id}>
                            <Stack spacing={0.75}>
                              <Stack alignItems="flex-start" direction="row" justifyContent="space-between" spacing={1}>
                                <Stack alignItems="center" direction="row" spacing={1.25} sx={{ minWidth: 0 }}>
                                  <Box className="inventory-workspace__receive-summary-image">
                                    {getImageUrl(item.imageName) ? (
                                      <Box
                                        alt={item.name}
                                        className="inventory-workspace__receive-summary-photo"
                                        component="img"
                                        src={getImageUrl(item.imageName)}
                                      />
                                    ) : (
                                      <Camera color="#94a3b8" size={22} />
                                    )}
                                  </Box>
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ color: '#0f172a', fontSize: 13, fontWeight: 900 }}>
                                      {item.name}
                                    </Typography>
                                    <Typography sx={{ color: '#64748b', fontSize: 12 }}>
                                      {item.code}
                                    </Typography>
                                  </Box>
                                </Stack>
                                <Stack direction="row" spacing={0.25}>
                                  <IconButton size="small" onClick={() => setReceiveDraftItem({ ...item })}>
                                    <Pencil size={16} />
                                  </IconButton>
                                  <IconButton color="error" size="small" onClick={(event) => handleRemoveSelectedItem(event, item.id)}>
                                    <Trash2 size={16} />
                                  </IconButton>
                                </Stack>
                              </Stack>

                              <Grid container spacing={1}>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                  <Typography sx={{ color: '#64748b', fontSize: 11 }}>รับเข้า</Typography>
                                  <Typography sx={{ color: '#0f172a', fontSize: 13, fontWeight: 800 }}>
                                    {Number(item.requestQty ?? 0).toLocaleString('th-TH')} {item.unit}
                                  </Typography>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                  <Typography sx={{ color: '#64748b', fontSize: 11 }}>เพิ่มสต๊อก</Typography>
                                  <Typography sx={{ color: '#0f172a', fontSize: 13, fontWeight: 800 }}>
                                    {getReceiveStockQty(item).toLocaleString('th-TH')} {item.issueUnit}
                                  </Typography>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                  <Typography sx={{ color: '#64748b', fontSize: 11 }}>ราคาซื้อ</Typography>
                                  <Typography sx={{ color: '#0f172a', fontSize: 13, fontWeight: 800 }}>
                                    {Number(item.unitCost ?? 0).toLocaleString('th-TH')}
                                  </Typography>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                  <Typography sx={{ color: '#64748b', fontSize: 11 }}>แปลงหน่วย</Typography>
                                  <Typography sx={{ color: '#0f172a', fontSize: 13, fontWeight: 800 }}>
                                    1 {item.unit} = {
                                      (shouldUseSameUnitConversion(item.unit, item.issueUnit)
                                        ? 1
                                        : Number(item.conversionQty ?? 1)
                                      ).toLocaleString('th-TH')
                                    } {item.issueUnit}
                                  </Typography>
                                </Grid>
                              </Grid>
                            </Stack>
                          </Box>
                        ))
                      )}
                    </Stack>
                  ) : (
                    <AppTable
                      columns={selectedTableColumns}
                      maxHeight={420}
                      noDataText={config.emptyText}
                      rowKey="id"
                      rows={selectedItems}
                      showColumnFilters={false}
                    />
                  )}

                  {mode === 'receive' ? null : (
                    <Stack spacing={1.25}>
                      <Grid container spacing={1.25}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            label="ยิง QR แผนก"
                            placeholder="สแกนรหัสแผนก"
                            size="small"
                            value={departmentCodeText}
                            onChange={(event) => setDepartmentCodeText(normalizeBarcodeInput(event.target.value))}
                            onKeyDown={handleDepartmentCodeKeyDown}
                            slotProps={{
                              input: {
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <Barcode color="#64748b" size={18} />
                                  </InputAdornment>
                                ),
                              },
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            required
                            select
                            label="เลือกแผนก"
                            size="small"
                            value={issueDepartmentCode}
                            onChange={(event) => handleDepartmentSelect(event.target.value)}
                            slotProps={{
                              select: {
                                displayEmpty: true,
                                open: isDepartmentSelectOpen,
                                onClose: () => {
                                  setIsDepartmentSelectOpen(false)
                                  setDepartmentSearchText('')
                                },
                                onOpen: () => setIsDepartmentSelectOpen(true),
                                renderValue: (selected) => {
                                  if (!selected) {
                                    return 'เลือกแผนก'
                                  }

                                  const department = departmentOptions.find((item) => item.code === selected)
                                  return department?.name ?? selected
                                },
                              },
                            }}
                          >
                            <MenuItem
                              disableRipple
                              value={departmentSearchOptionValue}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <TextField
                                autoFocus
                                fullWidth
                                placeholder="ค้นหาแผนก"
                                size="small"
                                value={departmentSearchText}
                                onChange={(event) => setDepartmentSearchText(event.target.value)}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                                slotProps={{
                                  input: {
                                    startAdornment: (
                                      <InputAdornment position="start">
                                        <Search color="#64748b" size={16} />
                                      </InputAdornment>
                                    ),
                                  },
                                }}
                              />
                            </MenuItem>
                            <MenuItem value="">เลือกแผนก</MenuItem>
                            {filteredDepartmentOptions.length === 0 ? (
                              <MenuItem disabled>ไม่พบแผนก</MenuItem>
                            ) : (
                              filteredDepartmentOptions.map((department) => (
                                <MenuItem key={department.id || department.code} value={department.code}>
                                  {department.name}
                                </MenuItem>
                              ))
                            )}
                          </TextField>
                        </Grid>
                      </Grid>
                      <TextField
                        fullWidth
                        required
                        helperText={issueDepartment ? `Code: ${issueDepartmentCode}` : 'ยิง QR หรือเลือกจากรายชื่อก่อนเบิก'}
                        label="ชื่อแผนกที่เลือก"
                        size="small"
                        value={issueDepartment}
                        slotProps={{
                          input: {
                            readOnly: true,
                          },
                        }}
                      />
                    </Stack>
                  )}

                  <Alert severity={mode === 'issue' ? 'info' : 'warning'}>
                    {mode === 'issue'
                      ? 'ตัวอย่าง FIFO: ถ้าล็อตแรกซื้อ 8 บาท และล็อตถัดไป 10 บาท ระบบจะตัด 8 บาทก่อน แล้วค่อยตัด 10 บาท'
                      : 'กรอกราคาต่อหน่วยแยกตามรายการรับเข้า เพื่อสร้างล็อตราคาและใช้ FIFO ตอนเบิกสินค้า'}
                  </Alert>

                  <Button
                    disabled={!canSubmit}
                    startIcon={<CheckSquare size={18} />}
                    sx={{ minHeight: 44, fontWeight: 800 }}
                    variant="contained"
                    onClick={() => setIsConfirmSaveOpen(true)}
                  >
                    {config.actionLabel}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>

    <Dialog
      fullWidth
      maxWidth="xs"
      open={isConfirmSaveOpen}
      onClose={() => setIsConfirmSaveOpen(false)}
    >
      <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
        <CheckSquare size={22} />
        ยืนยันการบันทึก
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Alert severity="info">
            ต้องการ{mode === 'receive' ? 'บันทึกรับเข้าสินค้า' : 'บันทึกเบิกสินค้า'}ใช่หรือไม่
          </Alert>
          <Typography sx={{ color: '#475569', fontSize: 14 }}>
            จำนวนรายการทั้งหมด <strong>{selectedItems.length.toLocaleString('th-TH')}</strong> รายการ
          </Typography>
          {mode === 'issue' ? (
            <Typography sx={{ color: '#475569', fontSize: 14 }}>
              แผนกที่เบิก <strong>{issueDepartment || '-'}</strong>
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={() => setIsConfirmSaveOpen(false)}>
          ยกเลิก
        </Button>
        <Button startIcon={<CheckSquare size={18} />} variant="contained" onClick={handleSubmitTransaction}>
          ยืนยันบันทึก
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog
      fullWidth
      maxWidth="sm"
      open={Boolean(receiveDraftItem)}
      onClose={() => setReceiveDraftItem(null)}
    >
      <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
        <Boxes size={22} />
        รับเข้าสินค้า
      </DialogTitle>
      <DialogContent>
        {receiveDraftItem ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box className="inventory-workspace__scan-product-detail">
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography className="inventory-workspace__detail-label">รหัสสินค้า</Typography>
                  <Typography className="inventory-workspace__detail-value">{receiveDraftItem.code}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <Typography className="inventory-workspace__detail-label">ชื่อสินค้า</Typography>
                  <Typography className="inventory-workspace__detail-value">{receiveDraftItem.name}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography className="inventory-workspace__detail-label">คงเหลือ</Typography>
                  <Typography className="inventory-workspace__detail-value">
                    {receiveDraftItem.stockQty} {receiveDraftItem.issueUnit}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography className="inventory-workspace__detail-label">รับเข้าเป็น</Typography>
                  <Typography className="inventory-workspace__detail-value">{receiveDraftItem.unit}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography className="inventory-workspace__detail-label">เบิกออกเป็น</Typography>
                  <Typography className="inventory-workspace__detail-value">{receiveDraftItem.issueUnit}</Typography>
                </Grid>
              </Grid>
            </Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 2.4 }}>
                <TextField
                  autoFocus
                  fullWidth
                  label="รับเข้าเป็น"
                  value={receiveDraftItem.unit}
                  onChange={(event) => handleReceiveDraftChange('unit', event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 2.4 }}>
                <TextField
                  fullWidth
                  helperText={`จำนวนที่รับเข้าจริง เช่น 10 ${receiveDraftItem.unit || 'หน่วย'}`}
                  label="จำนวนรับเข้า"
                  type="number"
                  value={receiveDraftItem.requestQty}
                  onChange={(event) => handleReceiveDraftChange('requestQty', event.target.value)}
                />
              </Grid>
              <Grid
                size={{ xs: 12, sm: 0.4 }}
                sx={{
                  alignItems: 'center',
                  display: 'flex',
                  height: 56,
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ color: '#0f172a', fontSize: 22, fontWeight: 900 }}>
                  =
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 2.4 }}>
                <TextField
                  fullWidth
                  helperText="หน่วยที่พนักงานใช้ตอนเบิก"
                  label="เบิกออกเป็น"
                  value={receiveDraftItem.issueUnit}
                  onChange={(event) => handleReceiveDraftChange('issueUnit', event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4.4 }}>
                <TextField
                  disabled={shouldUseSameUnitConversion(receiveDraftItem.unit, receiveDraftItem.issueUnit)}
                  fullWidth
                  helperText={
                    shouldUseSameUnitConversion(receiveDraftItem.unit, receiveDraftItem.issueUnit)
                      ? 'หน่วยรับเข้าและหน่วยเบิกเหมือนกัน ช่องนี้จะถูกปิด และระบบแปลง 1 ต่อ 1 ให้อัตโนมัติ'
                      : `กรอกจำนวน ${receiveDraftItem.issueUnit || 'หน่วยเบิก'} ต่อ 1 ${receiveDraftItem.unit || 'หน่วยรับเข้า'} เช่น 1 แพ็ค = 100 ชิ้น`
                  }
                  label={
                    shouldUseSameUnitConversion(receiveDraftItem.unit, receiveDraftItem.issueUnit)
                      ? 'จำนวนต่อ 1 หน่วยรับเข้า'
                      : `จำนวน${receiveDraftItem.issueUnit || 'หน่วยเบิก'}ต่อ 1 ${receiveDraftItem.unit || 'หน่วยรับเข้า'}`
                  }
                  type="number"
                  value={
                    shouldUseSameUnitConversion(receiveDraftItem.unit, receiveDraftItem.issueUnit)
                      ? 1
                      : receiveDraftItem.conversionQty ?? 1
                  }
                  onChange={(event) => handleReceiveDraftChange('conversionQty', event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  disabled
                  fullWidth
                  helperText={getConversionHelperText(receiveDraftItem)}
                  label="จำนวนหลังแปลง"
                  value={`${getReceiveStockQty(receiveDraftItem).toLocaleString('th-TH')} ${receiveDraftItem.issueUnit}`}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  disabled={isReceiveSupplierLocked}
                  fullWidth
                  helperText={
                    isReceiveSupplierLocked
                      ? 'ผู้ขายของใบรับเข้ารอบนี้'
                      : 'เลือกผู้ขายของล็อตราคานี้'
                  }
                  label="ผู้ขายที่ซื้อจาก *"
                  select
                  value={selectedSupplierId}
                  onChange={(event) => setSelectedSupplierId(event.target.value)}
                >
                  <MenuItem value="">เลือกผู้ขาย</MenuItem>
                  {suppliers.map((supplier) => (
                    <MenuItem key={supplier.supplierId} value={String(supplier.supplierId)}>
                      {supplier.supplierName}
                    </MenuItem>
                  ))}
                </TextField>
                {!isReceiveSupplierLocked ? (
                  <Button
                    size="small"
                    startIcon={<Plus size={15} />}
                    sx={{ mt: 0.5 }}
                    onClick={() => setIsSupplierDialogOpen(true)}
                  >
                    เพิ่มผู้ขาย
                  </Button>
                ) : null}
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="ราคาซื้อครั้งนี้"
                  type="number"
                  value={receiveDraftItem.unitCost ?? ''}
                  onChange={(event) => handleReceiveDraftChange('unitCost', event.target.value)}
                />
              </Grid>
            </Grid>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={() => setReceiveDraftItem(null)}>
          ยกเลิก
        </Button>
        <Button
          disabled={
            !receiveDraftItem
            || !selectedSupplierId
            || toPositiveNumber(receiveDraftItem.requestQty) <= 0
            || toPositiveNumber(receiveDraftItem.conversionQty) <= 0
            || receiveDraftItem.unitCost === ''
            || receiveDraftItem.unitCost === null
            || receiveDraftItem.unitCost === undefined
          }
          startIcon={<CheckSquare size={18} />}
          variant="contained"
          onClick={handleSaveReceiveDraft}
        >
          ตกลง
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog
      fullWidth
      maxWidth="sm"
      open={Boolean(matchedProduct)}
      onClose={() => setMatchedProduct(null)}
    >
      <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
        <Barcode size={22} />
        พบข้อมูลสินค้า
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="success">
            พบสินค้าในระบบและเพิ่มเข้ารายการ{mode === 'receive' ? 'นำเข้า' : 'เบิก'}ให้อัตโนมัติแล้ว
          </Alert>

          <Box className="inventory-workspace__scan-product-detail">
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography className="inventory-workspace__detail-label">รหัสสินค้า</Typography>
                <Typography className="inventory-workspace__detail-value">
                  {matchedProduct?.code}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography className="inventory-workspace__detail-label">บาร์โค้ด</Typography>
                <Typography className="inventory-workspace__detail-value">
                  {matchedProduct?.barcode || '-'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography className="inventory-workspace__detail-label">ชื่อสินค้า</Typography>
                <Typography className="inventory-workspace__detail-value">
                  {matchedProduct?.name}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography className="inventory-workspace__detail-label">หมวดหมู่</Typography>
                <Chip label={matchedProduct?.category || '-'} size="small" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography className="inventory-workspace__detail-label">สถานะสต๊อก</Typography>
                <Chip
                  color={
                    matchedProduct?.stockQty <= 0
                      ? 'error'
                      : matchedProduct?.stockQty <= matchedProduct?.minQty
                        ? 'warning'
                        : 'success'
                  }
                  label={
                    matchedProduct?.stockQty <= 0
                      ? 'ของหมด'
                      : matchedProduct?.stockQty <= matchedProduct?.minQty
                        ? 'ใกล้หมด'
                        : 'พร้อมใช้งาน'
                  }
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography className="inventory-workspace__detail-label">คงเหลือ</Typography>
                <Typography className="inventory-workspace__detail-value">
                  {matchedProduct?.stockQty ?? 0} {matchedProduct?.issueUnit}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography className="inventory-workspace__detail-label">ขั้นต่ำ</Typography>
                <Typography className="inventory-workspace__detail-value">
                  {matchedProduct?.minQty ?? 0} {matchedProduct?.issueUnit}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography className="inventory-workspace__detail-label">หน่วยรับเข้า</Typography>
                <Typography className="inventory-workspace__detail-value">
                  {matchedProduct?.receiveUnit || '-'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography className="inventory-workspace__detail-label">หน่วยเบิก</Typography>
                <Typography className="inventory-workspace__detail-value">
                  {matchedProduct?.issueUnit || '-'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography className="inventory-workspace__detail-label">ล็อตราคา / หมายเหตุ</Typography>
                <Typography className="inventory-workspace__detail-value">
                  {matchedProduct?.costLot || matchedProduct?.receiveHint || '-'}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="contained" onClick={() => setMatchedProduct(null)}>
          ตกลง
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog
      fullWidth
      maxWidth="xs"
      open={Boolean(missingIssueCode)}
      onClose={() => setMissingIssueCode('')}
    >
      <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
        <Barcode size={22} />
        ไม่พบสินค้า
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Alert severity="error">
            ไม่พบสินค้าในระบบ ไม่สามารถทำรายการเบิกได้
          </Alert>
          <Typography sx={{ color: '#475569', fontSize: 14 }}>
            QR/Barcode ที่ยิง: <strong>{missingIssueCode}</strong>
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="contained" onClick={() => setMissingIssueCode('')}>
          ตกลง
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog
      fullWidth
      maxWidth="md"
      open={isProductDialogOpen}
      onClose={() => {
        setIsProductDialogOpen(false)
        setIsProductFormSubmitted(false)
        setDuplicateProductCodeAlerted('')
      }}
    >
      <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
        <PackagePlus size={22} />
        เพิ่มสินค้าใหม่
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            ระบบจะเพิ่มสินค้าเข้าในรายการนำเข้าด้านขวาก่อน และจะบันทึกลงฐานข้อมูลเมื่อกดบันทึกรับเข้า
          </Alert>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                autoFocus
                fullWidth
                {...getProductFieldErrorProps('code', 'รหัสที่ใช้ค้นหาและอ้างอิงสินค้า')}
                required
                label="รหัสสินค้า"
                value={productForm.code}
                onChange={(event) => handleProductFormChange('code', event.target.value)}
                onBlur={(event) => handleDuplicateProductCheck('code', event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                {...getProductFieldErrorProps('name', 'ชื่อที่ผู้ใช้งานเห็นตอนค้นหาและเบิกสินค้า')}
                required
                label="ชื่อสินค้า"
                value={productForm.name}
                onChange={(event) => handleProductFormChange('name', event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                {...getProductFieldErrorProps('category', '')}
                required
                select
                label="ประเภทสินค้า"
                value={productForm.category}
                onChange={(event) => handleProductFormChange('category', event.target.value)}
              >
                {categories.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          <TextField
            fullWidth
            {...getProductFieldErrorProps('barcode', 'ใช้ยิงสแกน ถ้าไม่มีให้เว้นว่างได้')}
            label="บาร์โค้ด"
            value={productForm.barcode}
            onChange={(event) => handleProductFormChange('barcode', normalizeBarcodeInput(event.target.value))}
            onBlur={(event) => handleDuplicateProductCheck('barcode', event.target.value)}
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <TextField
                fullWidth
                {...getProductFieldErrorProps('receiveUnit', 'หน่วยตอนซื้อหรือรับของเข้า')}
                required
                label="รับเข้าเป็น"
                value={productForm.receiveUnit}
                onChange={(event) => handleProductFormChange('receiveUnit', event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <TextField
                fullWidth
                {...getProductFieldErrorProps('requestQty', `จำนวนที่รับเข้าจริง เช่น 10 ${productForm.receiveUnit || 'หน่วย'}`)}
                required
                label="จำนวนรับเข้า"
                type="number"
                value={productForm.requestQty}
                onChange={(event) => handleProductFormChange('requestQty', event.target.value)}
              />
            </Grid>
            <Grid
              size={{ xs: 12, sm: 0.4 }}
              sx={{
                alignItems: 'center',
                display: 'flex',
                height: 56,
                justifyContent: 'center',
              }}
            >
              <Typography sx={{ color: '#0f172a', fontSize: 22, fontWeight: 900 }}>
                =
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <TextField
                fullWidth
                {...getProductFieldErrorProps('issueUnit', 'หน่วยที่พนักงานใช้ตอนเบิก')}
                required
                label="เบิกออกเป็น"
                value={productForm.issueUnit}
                onChange={(event) => handleProductFormChange('issueUnit', event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4.4 }}>
              <TextField
                disabled={shouldUseSameUnitConversion(productForm.receiveUnit, productForm.issueUnit)}
                fullWidth
                required
                {...getProductFieldErrorProps(
                  'conversionQty',
                  shouldUseSameUnitConversion(productForm.receiveUnit, productForm.issueUnit)
                    ? 'หน่วยรับเข้าและหน่วยเบิกเหมือนกัน ช่องนี้จะถูกปิด และระบบแปลง 1 ต่อ 1 ให้อัตโนมัติ'
                    : `กรอกจำนวน ${productForm.issueUnit || 'หน่วยเบิก'} ต่อ 1 ${productForm.receiveUnit || 'หน่วยรับเข้า'} เช่น 1 แพ็ค = 100 ชิ้น`,
                )}
                label={
                  shouldUseSameUnitConversion(productForm.receiveUnit, productForm.issueUnit)
                    ? 'จำนวนต่อ 1 หน่วยรับเข้า'
                    : `จำนวน${productForm.issueUnit || 'หน่วยเบิก'}ต่อ 1 ${productForm.receiveUnit || 'หน่วยรับเข้า'}`
                }
                type="number"
                value={shouldUseSameUnitConversion(productForm.receiveUnit, productForm.issueUnit) ? 1 : productForm.conversionQty}
                onChange={(event) => handleProductFormChange('conversionQty', event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                disabled
                fullWidth
                helperText={getConversionHelperText({
                  issueUnit: productForm.issueUnit,
                  receiveUnit: productForm.receiveUnit,
                  requestQty: productForm.requestQty,
                  unit: productForm.receiveUnit,
                  conversionQty: productFormConversionQty,
                })}
                label="จำนวนหลังแปลง"
                value={`${productFormStockQty.toLocaleString('th-TH')} ${productForm.issueUnit || ''}`.trim()}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                {...getProductFieldErrorProps('minQty', `ถ้าเหลือไม่เกินจำนวนนี้ ระบบจะแจ้งใกล้หมด (${productForm.issueUnit || 'หน่วยเบิก'})`)}
                required
                label="เตือนเมื่อเหลือไม่เกิน"
                type="number"
                value={productForm.minQty}
                onChange={(event) => handleProductFormChange('minQty', event.target.value)}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                fullWidth
                required
                error={isProductFormSubmitted && !selectedSupplierId}
                helperText={
                  isProductFormSubmitted && !selectedSupplierId
                    ? 'กรุณาเลือกผู้ขายก่อนเพิ่มรายการรับเข้า'
                    : 'ผู้ขายของล็อตราคานี้'
                }
                label="ผู้ขาย"
                size="small"
                value={selectedSupplierId}
                onChange={(event) => setSelectedSupplierId(event.target.value)}
              >
                <MenuItem value="">เลือกผู้ขาย</MenuItem>
                {suppliers.map((supplier) => (
                  <MenuItem key={supplier.supplierId} value={String(supplier.supplierId)}>
                    {supplier.supplierName}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                size="small"
                startIcon={<Plus size={15} />}
                sx={{ mt: 0.5 }}
                onClick={() => setIsSupplierDialogOpen(true)}
              >
                เพิ่มผู้ขาย
              </Button>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                {...getProductFieldErrorProps('costLot', 'ใช้คำนวณต้นทุนและ FIFO')}
                required
                label="ราคาซื้อครั้งนี้"
                value={productForm.costLot}
                onChange={(event) => handleProductFormChange('costLot', event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                fullWidth
                label="หมายเหตุ"
                placeholder="ใส่รายละเอียดเพิ่มเติมได้ตามต้องการ"
                value={productForm.receiveHint}
                onChange={(event) => handleProductFormChange('receiveHint', event.target.value)}
              />
            </Grid>
          </Grid>

          <Stack spacing={1}>
            <Typography sx={{ color: '#111827', fontSize: 14, fontWeight: 800 }}>
              รูปสินค้า
            </Typography>
            <Box
              className="inventory-workspace__dialog-upload-box"
              sx={
                isProductFormSubmitted && productFormErrors.imageName
                  ? {
                      borderColor: '#d32f2f',
                      color: '#d32f2f',
                    }
                  : undefined
              }
            >
              {productFormImageUrl ? (
                <Box
                  alt="รูปสินค้า"
                  className="inventory-workspace__dialog-photo"
                  component="img"
                  src={productFormImageUrl}
                />
              ) : (
                <Upload color="#64748b" size={24} />
              )}
              <Typography sx={{ fontSize: 13 }}>
                {productFormImageUrl ? 'อัปโหลดรูปสินค้าแล้ว' : 'แนบรูปสินค้าใหม่หลังกรอกข้อมูลสินค้า'}
              </Typography>
            </Box>
            {isProductFormSubmitted && productFormErrors.imageName ? (
              <Typography sx={{ color: '#d32f2f', fontSize: 12, ml: 1.75 }}>
                กรุณาแนบรูปสินค้า
              </Typography>
            ) : null}
            <Button component="label" startIcon={<Upload size={18} />} variant="outlined">
              แนบรูปสินค้า
              <input
                accept="image/*"
                hidden
                type="file"
                onChange={handleAttachProductImage}
              />
            </Button>
          </Stack>

        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          color="inherit"
          onClick={() => {
            setIsProductDialogOpen(false)
            setIsProductFormSubmitted(false)
            setDuplicateProductCodeAlerted('')
          }}
        >
          ยกเลิก
        </Button>
        <Button
          startIcon={<CheckSquare size={18} />}
          variant="contained"
          onClick={() => {
            setIsProductFormSubmitted(true)

            if (canOpenNewProductConfirm) {
              setIsConfirmNewProductOpen(true)
            }
          }}
        >
          เพิ่มเข้ารายการนำเข้า
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog
      fullWidth
      maxWidth="xs"
      open={isConfirmNewProductOpen}
      onClose={() => setIsConfirmNewProductOpen(false)}
    >
      <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
        <PackagePlus size={22} />
        {existingDuplicateProduct ? 'พบสินค้านี้ในระบบแล้ว' : 'ยืนยันการบันทึก'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Alert severity={existingDuplicateProduct ? 'error' : 'info'}>
            {existingDuplicateProduct
              ? `${duplicateProductField === 'barcode' ? 'บาร์โค้ดนี้' : 'รหัสสินค้านี้'}มีอยู่แล้วในระบบ ไม่สามารถเพิ่มเป็นสินค้าใหม่ซ้ำได้ กรุณาเลือกสินค้านี้จากรายการสินค้าเดิม แล้วกรอกข้อมูลรับเข้าแทน`
              : 'ต้องการเพิ่มสินค้าใหม่เข้าในรายการนำเข้าใช่หรือไม่'}
          </Alert>
          <Typography sx={{ color: '#475569', fontSize: 14 }}>
            รหัสสินค้า <strong>{productForm.code || '-'}</strong>
          </Typography>
          <Typography sx={{ color: '#475569', fontSize: 14 }}>
            ชื่อสินค้า <strong>{existingDuplicateProduct?.name || productForm.name || '-'}</strong>
          </Typography>
          {existingDuplicateProduct ? (
            <Typography sx={{ color: '#475569', fontSize: 14 }}>
              สินค้าที่มีอยู่ <strong>
                รับเข้าเป็น {existingDuplicateProduct.receiveUnit || '-'} / เบิกออกเป็น {existingDuplicateProduct.issueUnit || '-'} / 1 {existingDuplicateProduct.receiveUnit || 'หน่วย'} = {existingDuplicateProduct.conversionQty || 1} {existingDuplicateProduct.issueUnit || 'หน่วย'}
              </strong>
            </Typography>
          ) : null}
          <Typography sx={{ color: existingDuplicateProduct ? '#d32f2f' : '#475569', fontSize: 14 }}>
            ข้อมูลที่กรอก <strong>
              รับเข้าเป็น {productForm.receiveUnit || '-'} / เบิกออกเป็น {productForm.issueUnit || '-'} / 1 {productForm.receiveUnit || 'หน่วย'} = {productFormConversionQty || 1} {productForm.issueUnit || 'หน่วย'}
            </strong>
          </Typography>
          <Typography sx={{ color: '#475569', fontSize: 14 }}>
            จำนวนรับเข้า <strong>{productForm.requestQty || 0} {productForm.receiveUnit || ''}</strong>
          </Typography>
          <Typography sx={{ color: '#475569', fontSize: 14 }}>
            เพิ่ม stock <strong>{productFormStockQty.toLocaleString('th-TH')} {productForm.issueUnit || ''}</strong>
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={() => setIsConfirmNewProductOpen(false)}>
          ยกเลิก
        </Button>
        <Button
          disabled={Boolean(existingDuplicateProduct)}
          startIcon={<CheckSquare size={18} />}
          variant="contained"
          onClick={() => {
            setIsConfirmNewProductOpen(false)
            handleSaveNewProduct()
          }}
        >
          ยืนยันบันทึก
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog
      open={isSupplierDialogOpen}
      fullWidth
      maxWidth="xs"
      onClose={() => !isSavingSupplier && setIsSupplierDialogOpen(false)}
    >
      <DialogTitle>เพิ่มผู้ขาย</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="ชื่อผู้ขาย"
          margin="dense"
          value={supplierName}
          onChange={(event) => setSupplierName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleCreateSupplier()
            }
          }}
        />
        <Button
          fullWidth
          variant="outlined"
          sx={{ mt: 2 }}
          disabled={isSavingSupplier}
          onClick={() => setIsSupplierManagementOpen(true)}
        >
          จัดการผู้ขาย / ยกเลิกผู้ขาย
        </Button>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button disabled={isSavingSupplier} onClick={() => setIsSupplierDialogOpen(false)}>ยกเลิก</Button>
        <Button disabled={isSavingSupplier} variant="contained" onClick={handleCreateSupplier}>บันทึก</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={isSupplierManagementOpen} fullWidth maxWidth="sm" onClose={() => !updatingSupplierId && setIsSupplierManagementOpen(false)}>
      <DialogTitle>จัดการผู้ขาย</DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          ยกเลิกผู้ขายเพื่อไม่ให้เลือกในรายการรับเข้าใหม่ ประวัติการรับเข้าและต้นทุนเดิมจะยังคงอยู่
        </Alert>
        <AppTable
          columns={[
            {
              key: 'supplierName',
              label: 'ชื่อผู้ขาย',
              minWidth: 230,
              value: (supplier) => supplier.supplierName,
            },
            {
              key: 'supplierStatus',
              label: 'สถานะ',
              align: 'center',
              minWidth: 120,
              sortValue: (supplier) => Number(supplier.supplierStatus ?? 1),
              value: (supplier) => Number(supplier.supplierStatus ?? 1) === 1 ? 'ใช้งาน' : 'ไม่ใช้งาน',
              render: (supplier) => {
                const active = Number(supplier.supplierStatus ?? 1) === 1
                return <Chip color={active ? 'success' : 'error'} label={active ? 'ใช้งาน' : 'ไม่ใช้งาน'} size="small" />
              },
            },
            {
              key: 'actions',
              label: 'จัดการ',
              align: 'center',
              minWidth: 150,
              searchable: false,
              sortable: false,
              render: (supplier) => {
                const active = Number(supplier.supplierStatus ?? 1) === 1
                return (
                  <Button
                    color={active ? 'error' : 'success'}
                    disabled={updatingSupplierId === supplier.supplierId}
                    onClick={() => handleSupplierStatusChange(supplier)}
                    size="small"
                    variant="outlined"
                  >
                    {active ? 'ยกเลิกผู้ขาย' : 'เปิดใช้งาน'}
                  </Button>
                )
              },
            },
          ]}
          defaultSortDirection="asc"
          defaultSortField="supplierName"
          fitToWidth
          maxHeight={360}
          noDataText="ยังไม่มีผู้ขาย"
          rows={allSuppliers}
          rowKey="supplierId"
          showGlobalSearch
          globalSearchPlaceholder="ค้นหาผู้ขาย"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => setIsSupplierManagementOpen(false)}>ปิด</Button>
      </DialogActions>
    </Dialog>
    </>
  )
}

export default InventoryWorkspace
