export type UnitPref = 'auto' | 'km' | 'mi'

export type ShopperMode = 'treasure' | 'reseller' | 'bargain' | 'casual'

export const CATEGORY_OPTIONS = [
  'Antiques & Collectibles',
  'Tools & Hardware',
  'Electronics',
  'Furniture',
  'Vinyl/Media',
  'Clothing & Apparel',
  'Toys/Kids',
] as const
export type Category = typeof CATEGORY_OPTIONS[number]

export interface Weights {
  distance: number // 0..1 (emphasis on minimizing travel)
  time: number     // 0..1 (opening/closing time fit)
  quality: number  // 0..1 (keywords/ratings/photos)
  weather: number  // 0..1 (outdoor vs rain/heat)
  favorites: number // 0..1 (favorite boost)
}

export interface Constraints {
  maxStops?: number // cap number of stops considered
}

export interface TravelPrefs {
  style: 'local' | 'city' | 'road'
  radiusMi: number // default radius in miles
}

export interface DisplayPrefs {
  defaultTab: 'feed' | 'map' | 'route'
  view: 'compact' | 'grid'
  theme: 'auto' | 'light' | 'dark'
}

export interface SocialPrefs {
  showRatings: boolean
  showFinds: boolean
  privateMode: boolean
}

export interface AlertPrefs {
  autoFavoriteKeywords: string // comma-separated
  push: boolean
  email: boolean
  smartThreshold: number // 0..1
}

export interface Preferences {
  unit: UnitPref
  weights: Weights
  constraints: Constraints
  mode: ShopperMode
  categories: Category[]
  travel: TravelPrefs
  timeOfDay: 'early' | 'midday' | 'flex'
  weatherSensitivity: 'fair' | 'all'
  display: DisplayPrefs
  social: SocialPrefs
  alerts: AlertPrefs
}

export const defaultPreferences: Preferences = {
  unit: 'auto',
  weights: {
    distance: 0.4,
    time: 0.2,
    quality: 0.3,
    weather: 0.05,
    favorites: 0.05,
  },
  constraints: {
    maxStops: undefined,
  },
  mode: 'casual',
  categories: [],
  travel: { style: 'local', radiusMi: 10 },
  timeOfDay: 'flex',
  weatherSensitivity: 'all',
  display: { defaultTab: 'feed', view: 'grid', theme: 'auto' },
  social: { showRatings: true, showFinds: true, privateMode: false },
  alerts: { autoFavoriteKeywords: '', push: false, email: false, smartThreshold: 0.6 },
}

const LS_KEY = 'salestrail:preferences:v1'

export function loadPreferences(): Preferences {
  if (typeof window === 'undefined') return defaultPreferences
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return defaultPreferences
    const parsed = JSON.parse(raw)
    return {
      ...defaultPreferences,
      ...parsed,
      weights: { ...defaultPreferences.weights, ...(parsed?.weights || {}) },
      constraints: { ...defaultPreferences.constraints, ...(parsed?.constraints || {}) },
      travel: { ...defaultPreferences.travel, ...(parsed?.travel || {}) },
      display: { ...defaultPreferences.display, ...(parsed?.display || {}) },
      social: { ...defaultPreferences.social, ...(parsed?.social || {}) },
      alerts: { ...defaultPreferences.alerts, ...(parsed?.alerts || {}) },
    }
  } catch {
    return defaultPreferences
  }
}

export function savePreferences(p: Preferences) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(p))
  } catch {}
}
