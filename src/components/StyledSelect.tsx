import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import styles from './StyledSelect.module.css'

export type StyledSelectChangeEvent = {
  target: {
    value: string
  }
}

type StyledSelectOption = {
  value: string
  label: ReactNode
  disabled?: boolean
  previewSrc?: string
  previewTitle?: string
}

type StyledSelectProps = {
  value?: string | null
  onChange?: (event: StyledSelectChangeEvent) => void
  children: ReactNode
  className?: string
  disabled?: boolean
}

function stringifyOptionLabel(label: ReactNode): string {
  if (label === null || label === undefined || typeof label === 'boolean') {
    return ''
  }

  if (typeof label === 'string' || typeof label === 'number') {
    return String(label)
  }

  if (Array.isArray(label)) {
    return label.map((item) => stringifyOptionLabel(item)).join('')
  }

  if (isValidElement<{ children?: ReactNode }>(label)) {
    return stringifyOptionLabel(label.props.children)
  }

  return ''
}

export function StyledSelect({
  value,
  onChange,
  children,
  className,
  disabled = false,
}: StyledSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [isOpenState, setIsOpenState] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({})
  const [previewState, setPreviewState] = useState<{
    src: string
    title: string
    style: CSSProperties
  } | null>(null)

  const options = Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string
        children?: ReactNode
        disabled?: boolean
        'data-preview-src'?: string
        'data-preview-title'?: string
      }>(child) ||
      child.type !== 'option'
    ) {
      return []
    }

    return [
      {
        value: String(child.props.value ?? ''),
        label: child.props.children,
        disabled: Boolean(child.props.disabled),
        previewSrc: child.props['data-preview-src'],
        previewTitle: child.props['data-preview-title'],
      } satisfies StyledSelectOption,
    ]
  })

  const isOpen = isOpenState && !disabled
  const preview = isOpen ? previewState : null
  const selectedValue = value ?? ''
  const selectedOption = options.find((option) => option.value === selectedValue) ?? null
  const rootClassName = [
    styles.root,
    isOpen ? styles.open : '',
    disabled ? styles.disabled : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const closeSelect = () => {
    setIsOpenState(false)
    setPreviewState(null)
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()

      if (!rect) {
        return
      }

      const forceBelow = className?.includes('image-library-select')
      const maxHeight = forceBelow
        ? Math.max(140, Math.min(320, window.innerHeight - rect.bottom - 16))
        : Math.min(320, window.innerHeight - 32)
      const estimatedHeight = Math.min(maxHeight, options.length * 40 + 16)
      const spaceBelow = window.innerHeight - rect.bottom - 16
      const placeAbove = !forceBelow && spaceBelow < estimatedHeight && rect.top > estimatedHeight + 16
      const top = placeAbove ? Math.max(16, rect.top - estimatedHeight - 8) : rect.bottom + 8
      const left = Math.min(rect.left, window.innerWidth - Math.max(rect.width, 220) - 16)

      setPopoverStyle({
        top,
        left: Math.max(16, left),
        width: Math.max(rect.width, 220),
        maxHeight,
      })
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (
        target instanceof Node &&
        (rootRef.current?.contains(target) || popoverRef.current?.contains(target))
      ) {
        return
      }

      closeSelect()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSelect()
      }
    }

    updatePosition()
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [className, isOpen, options.length])

  function showOptionPreview(option: StyledSelectOption, element: HTMLElement) {
    if (!option.previewSrc) {
      setPreviewState(null)
      return
    }

    const rect = element.getBoundingClientRect()
    const width = 180
    const height = 124
    const gap = 12
    const canPlaceRight = rect.right + gap + width <= window.innerWidth - 16
    const left = canPlaceRight ? rect.right + gap : Math.max(16, rect.left - gap - width)
    const top = Math.min(
      window.innerHeight - height - 16,
      Math.max(16, rect.top + rect.height / 2 - height / 2),
    )

    setPreviewState({
      src: option.previewSrc,
      title: option.previewTitle || '',
      style: { left, top, width },
    })
  }

  return (
    <div
      className={rootClassName}
      ref={rootRef}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={styles.trigger}
        data-overflow-tooltip={selectedOption ? stringifyOptionLabel(selectedOption.label) : undefined}
        disabled={disabled}
        onClick={() => setIsOpenState((currentValue) => !currentValue)}
        ref={triggerRef}
        type="button"
      >
        <span
          className={`${styles.label} ${selectedOption ? '' : styles.placeholder}`.trim()}
          data-overflow-tooltip-measure
        >
          {selectedOption?.label ?? ''}
        </span>
        <i aria-hidden="true" className="fa-solid fa-chevron-down" />
      </button>
      {isOpen
        ? createPortal(
            <>
              <div className={styles.popover} ref={popoverRef} role="listbox" style={popoverStyle}>
                {options.map((option) => (
                  <button
                    aria-selected={option.value === selectedValue}
                    className={`${styles.option} ${option.value === selectedValue ? styles.selected : ''}`.trim()}
                    disabled={option.disabled}
                    key={option.value}
                    onBlur={() => setPreviewState(null)}
                    onClick={() => {
                      if (option.disabled) {
                        return
                      }

                      onChange?.({ target: { value: option.value } })
                      closeSelect()
                    }}
                    onFocus={(event) => showOptionPreview(option, event.currentTarget)}
                    onPointerEnter={(event) => showOptionPreview(option, event.currentTarget)}
                    onPointerLeave={() => setPreviewState(null)}
                    type="button"
                  >
                    <span className={styles.optionLabel}>{option.label}</span>
                    {option.value === selectedValue ? (
                      <i aria-hidden="true" className="fa-solid fa-check" />
                    ) : null}
                  </button>
                ))}
              </div>
              {preview ? (
                <div className={styles.imagePreview} style={preview.style}>
                  <img alt="" src={preview.src} />
                  <span>{preview.title}</span>
                </div>
              ) : null}
            </>,
            document.body,
          )
        : null}
    </div>
  )
}
