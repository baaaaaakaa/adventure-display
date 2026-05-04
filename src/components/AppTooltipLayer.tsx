import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto'

type ActiveTooltip = {
  content: string
  placement: TooltipPlacement
  target: HTMLElement
}

type TooltipCoordinates = {
  left: number
  top: number
}

const tooltipTargetSelector = '[data-tooltip], [data-overflow-tooltip], input, select, textarea'
const tooltipDisabledSelector = '[data-tooltip-disabled="true"]'
const textInputTypesWithoutOverflowTooltip = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])
const generatedOverflowTooltipAttribute = 'data-generated-overflow-tooltip'
const suppressedOverflowTooltipAttribute = 'data-suppressed-overflow-tooltip'

function isEditableFormControl(element: HTMLElement | null) {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  )
}

function normalizeTooltipElement(element: HTMLElement) {
  if (element.closest(tooltipDisabledSelector)) {
    element.removeAttribute('title')
    delete element.dataset.tooltip
    return
  }

  const title = element.getAttribute('title')

  if (!title) {
    return
  }

  if (!element.dataset.tooltip) {
    element.dataset.tooltip = title
  }

  element.removeAttribute('title')
}

function normalizeTooltipTree(root: ParentNode) {
  if (!(root instanceof HTMLElement) && !(root instanceof Document) && !(root instanceof DocumentFragment)) {
    return
  }

  if (root instanceof HTMLElement) {
    normalizeTooltipElement(root)
  }

  root.querySelectorAll<HTMLElement>('[title]').forEach((element) => {
    normalizeTooltipElement(element)
  })
}

function setGeneratedOverflowTooltip(element: HTMLElement, content: string | null) {
  const previousGeneratedContent = element.getAttribute(generatedOverflowTooltipAttribute)

  if (isEditableFormControl(element) && document.activeElement === element) {
    if (previousGeneratedContent !== null && element.dataset.tooltip === previousGeneratedContent) {
      delete element.dataset.tooltip
    }

    element.removeAttribute(generatedOverflowTooltipAttribute)
    return
  }

  if (element.getAttribute(suppressedOverflowTooltipAttribute) !== null) {
    return
  }

  if (!content) {
    if (previousGeneratedContent !== null && element.dataset.tooltip === previousGeneratedContent) {
      delete element.dataset.tooltip
    }

    element.removeAttribute(generatedOverflowTooltipAttribute)
    return
  }

  if (element.dataset.tooltip && element.dataset.tooltip !== previousGeneratedContent) {
    return
  }

  element.dataset.tooltip = content
  element.setAttribute(generatedOverflowTooltipAttribute, content)
}

function getTooltipPlacement(element: HTMLElement): TooltipPlacement {
  const placement = element.dataset.tooltipPlacement

  if (placement === 'top' || placement === 'bottom' || placement === 'left' || placement === 'right') {
    return placement
  }

  return 'auto'
}

function getTooltipTarget(element: EventTarget | null) {
  if (!(element instanceof Element)) {
    return null
  }

  if (element.closest(tooltipDisabledSelector)) {
    return null
  }

  const target = element.closest<HTMLElement>(tooltipTargetSelector)

  if (target?.closest(tooltipDisabledSelector)) {
    return null
  }

  return target
}

function getTextWidth(element: HTMLElement, text: string) {
  const computedStyle = window.getComputedStyle(element)
  const measuringElement = document.createElement('span')

  measuringElement.style.position = 'fixed'
  measuringElement.style.left = '-9999px'
  measuringElement.style.top = '-9999px'
  measuringElement.style.visibility = 'hidden'
  measuringElement.style.whiteSpace = 'pre'
  measuringElement.style.font = computedStyle.font
  measuringElement.style.letterSpacing = computedStyle.letterSpacing
  measuringElement.textContent = text
  document.body.appendChild(measuringElement)

  const width = measuringElement.getBoundingClientRect().width
  measuringElement.remove()

  return width
}

function getAvailableTextWidth(element: HTMLElement, reservedWidth = 0) {
  const computedStyle = window.getComputedStyle(element)
  const horizontalPadding =
    Number.parseFloat(computedStyle.paddingLeft) + Number.parseFloat(computedStyle.paddingRight)

  return element.clientWidth - (Number.isFinite(horizontalPadding) ? horizontalPadding : 0) - reservedWidth
}

function isSingleLineTextOverflowing(element: HTMLElement, text: string, reservedWidth = 0) {
  return (
    element.scrollWidth > element.clientWidth + 1 ||
    getTextWidth(element, text) > getAvailableTextWidth(element, reservedWidth) + 1
  )
}

function isElementOverflowing(element: HTMLElement) {
  return element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1
}

function getFormControlOverflowTooltip(element: HTMLElement) {
  if (element instanceof HTMLInputElement) {
    if (textInputTypesWithoutOverflowTooltip.has(element.type)) {
      return null
    }

    const value = element.value.trim()

    if (!value || !isSingleLineTextOverflowing(element, value)) {
      return null
    }

    return value
  }

  if (element instanceof HTMLSelectElement) {
    const value = element.selectedOptions[0]?.textContent?.trim() ?? ''

    if (!value || !isSingleLineTextOverflowing(element, value, 28)) {
      return null
    }

    return value
  }

  if (element instanceof HTMLTextAreaElement) {
    const value = element.value.trim()

    if (!value || !isElementOverflowing(element)) {
      return null
    }

    return value
  }

  return null
}

function refreshGeneratedOverflowTooltips(root: ParentNode = document) {
  if (!('querySelectorAll' in root)) {
    return
  }

  const tooltipElements = [
    ...(root instanceof HTMLElement && root.matches('input, select, textarea, [data-overflow-tooltip]')
      ? [root]
      : []),
    ...Array.from(root.querySelectorAll<HTMLElement>('input, select, textarea, [data-overflow-tooltip]')),
  ]

  tooltipElements.forEach((element) => {
    const overflowContent =
      getOverflowTooltip(element) ?? getFormControlOverflowTooltip(element)

    setGeneratedOverflowTooltip(element, overflowContent)
  })
}

function getOverflowTooltip(element: HTMLElement) {
  const content = element.dataset.overflowTooltip?.trim()

  if (!content) {
    return null
  }

  const measuringElement =
    element.querySelector<HTMLElement>('[data-overflow-tooltip-measure]') ?? element

  return isElementOverflowing(measuringElement) ? content : null
}

function getTooltipContent(element: HTMLElement) {
  if (isEditableFormControl(element) && document.activeElement === element) {
    return null
  }

  if (
    element.getAttribute(suppressedOverflowTooltipAttribute) !== null ||
    (element.getAttribute(generatedOverflowTooltipAttribute) !== null && document.activeElement === element)
  ) {
    return null
  }

  const explicitContent = element.dataset.tooltip?.trim()

  if (explicitContent) {
    return explicitContent
  }

  return getOverflowTooltip(element) ?? getFormControlOverflowTooltip(element)
}

function hasGeneratedOverflowTooltip(element: HTMLElement | null) {
  return element !== null && element.getAttribute(generatedOverflowTooltipAttribute) !== null
}

function suppressGeneratedOverflowTooltip(element: HTMLElement | null) {
  if (!hasGeneratedOverflowTooltip(element)) {
    return false
  }

  const generatedContent = element.getAttribute(generatedOverflowTooltipAttribute)

  element.setAttribute(suppressedOverflowTooltipAttribute, 'true')

  if (generatedContent !== null && element.dataset.tooltip === generatedContent) {
    delete element.dataset.tooltip
  }

  return true
}

function restoreGeneratedOverflowTooltip(element: HTMLElement | null) {
  if (!element || element.getAttribute(suppressedOverflowTooltipAttribute) === null) {
    return
  }

  element.removeAttribute(suppressedOverflowTooltipAttribute)
  refreshGeneratedOverflowTooltips(element)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function AppTooltipLayer() {
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null)
  const [coordinates, setCoordinates] = useState<TooltipCoordinates | null>(null)

  useEffect(() => {
    normalizeTooltipTree(document)
    refreshGeneratedOverflowTooltips(document)

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          normalizeTooltipElement(mutation.target)
          refreshGeneratedOverflowTooltips(mutation.target)
        }

        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement || node instanceof DocumentFragment) {
            normalizeTooltipTree(node)
            refreshGeneratedOverflowTooltips(node)
          }
        })
      })
    })

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['title', 'value', 'data-overflow-tooltip'],
    })

    const handleInput = (event: Event) => {
      if (event.target instanceof HTMLElement) {
        refreshGeneratedOverflowTooltips(event.target)
      }
    }

    const handleLayoutChange = () => {
      refreshGeneratedOverflowTooltips(document)
    }

    document.addEventListener('input', handleInput, true)
    document.addEventListener('change', handleInput, true)
    window.addEventListener('resize', handleLayoutChange)
    window.addEventListener('scroll', handleLayoutChange, true)

    return () => {
      observer.disconnect()
      document.removeEventListener('input', handleInput, true)
      document.removeEventListener('change', handleInput, true)
      window.removeEventListener('resize', handleLayoutChange)
      window.removeEventListener('scroll', handleLayoutChange, true)
    }
  }, [])

  useEffect(() => {
    const showTooltip = (element: HTMLElement | null) => {
      if (!element) {
        setActiveTooltip(null)
        return
      }

      const content = getTooltipContent(element)

      if (!content) {
        setActiveTooltip(null)
        return
      }

      setActiveTooltip({
        content,
        placement: getTooltipPlacement(element),
        target: element,
      })
    }

    const handlePointerOver = (event: PointerEvent) => {
      showTooltip(getTooltipTarget(event.target))
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (suppressGeneratedOverflowTooltip(getTooltipTarget(event.target))) {
        setActiveTooltip(null)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const target = getTooltipTarget(event.target)

      if (target === activeTooltip?.target) {
        if (!getTooltipContent(target)) {
          setActiveTooltip(null)
        }

        return
      }

      showTooltip(target)
    }

    const handlePointerOut = (event: PointerEvent) => {
      const currentTarget = getTooltipTarget(event.target)
      const nextTarget = getTooltipTarget(event.relatedTarget)

      if (currentTarget && currentTarget === nextTarget) {
        return
      }

      if (activeTooltip?.target && nextTarget === activeTooltip.target) {
        return
      }

      if (currentTarget === activeTooltip?.target) {
        setActiveTooltip(null)
      }
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = getTooltipTarget(event.target)

      if (isEditableFormControl(target) && document.activeElement === target) {
        setActiveTooltip(null)
        return
      }

      if (suppressGeneratedOverflowTooltip(target)) {
        setActiveTooltip(null)
        return
      }

      showTooltip(target)
    }

    const handleFocusOut = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) {
        restoreGeneratedOverflowTooltip(event.target)
      }

      const nextTarget = getTooltipTarget(event.relatedTarget)

      if (nextTarget && nextTarget === activeTooltip?.target) {
        return
      }

      setActiveTooltip(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveTooltip(null)
      }
    }

    const handleActiveControlInput = (event: Event) => {
      if (
        event.target instanceof HTMLElement &&
        isEditableFormControl(event.target) &&
        document.activeElement === event.target
      ) {
        setActiveTooltip(null)
      }
    }

    document.addEventListener('pointerover', handlePointerOver, true)
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handlePointerMove, true)
    document.addEventListener('pointerout', handlePointerOut, true)
    document.addEventListener('focusin', handleFocusIn, true)
    document.addEventListener('focusout', handleFocusOut, true)
    document.addEventListener('input', handleActiveControlInput, true)
    document.addEventListener('change', handleActiveControlInput, true)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerover', handlePointerOver, true)
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerout', handlePointerOut, true)
      document.removeEventListener('focusin', handleFocusIn, true)
      document.removeEventListener('focusout', handleFocusOut, true)
      document.removeEventListener('input', handleActiveControlInput, true)
      document.removeEventListener('change', handleActiveControlInput, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeTooltip])

  useLayoutEffect(() => {
    if (!activeTooltip || !tooltipRef.current) {
      return
    }

    const updatePosition = () => {
      const { target, placement } = activeTooltip

      if (!document.body.contains(target)) {
        setActiveTooltip(null)
        return
      }

      const targetRect = target.getBoundingClientRect()
      const tooltipRect = tooltipRef.current?.getBoundingClientRect()

      if (!tooltipRect) {
        return
      }

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const gap = 10
      const safeMargin = 12
      const resolvedPlacement =
        placement === 'auto'
          ? targetRect.top >= tooltipRect.height + safeMargin + gap
            ? 'top'
            : 'bottom'
          : placement

      let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
      let top =
        resolvedPlacement === 'top'
          ? targetRect.top - tooltipRect.height - gap
          : targetRect.bottom + gap

      if (resolvedPlacement === 'left') {
        left = targetRect.left - tooltipRect.width - gap
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2
      }

      if (resolvedPlacement === 'right') {
        left = targetRect.right + gap
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2
      }

      left = clamp(left, safeMargin, viewportWidth - tooltipRect.width - safeMargin)
      top = clamp(top, safeMargin, viewportHeight - tooltipRect.height - safeMargin)

      setCoordinates({ left, top })
    }

    updatePosition()

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [activeTooltip])

  if (!activeTooltip) {
    return null
  }

  return createPortal(
    <div
      aria-hidden="true"
      className="app-tooltip-layer"
      ref={tooltipRef}
      style={{
        left: `${coordinates?.left ?? -9999}px`,
        top: `${coordinates?.top ?? -9999}px`,
        visibility: coordinates ? 'visible' : 'hidden',
      }}
    >
      {activeTooltip.content}
    </div>,
    document.body,
  )
}
