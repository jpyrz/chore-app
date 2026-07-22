import {
  Dog,
  Leaf,
  PackageOpen,
  Shirt,
  Sparkles,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import type { ChoreCategory } from '../types/domain'
import styles from './shared.module.scss'

const icons: Record<ChoreCategory, LucideIcon> = {
  kitchen: Utensils,
  outside: Leaf,
  pets: Dog,
  tidy: Sparkles,
  laundry: Shirt,
  other: PackageOpen,
}

export function CategoryIcon({ category }: { category: ChoreCategory }) {
  const Icon = icons[category]
  return (
    <span className={`${styles.categoryIcon} ${styles[category]}`} aria-hidden="true">
      <Icon size={22} strokeWidth={2.2} />
    </span>
  )
}
