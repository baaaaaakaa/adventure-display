import type { MapGridSettings } from '../types/adventure'

export type FogRect = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

function parseFogCellId(cellId: string) {
  const [columnRaw, rowRaw] = cellId.split(':')
  const column = Number(columnRaw)
  const row = Number(rowRaw)

  return { column, row }
}

export function getFogCellRects(cellIds: string[], mapGrid: MapGridSettings): FogRect[] {
  const remaining = new Set<string>()

  cellIds.forEach((cellId) => {
    const { column, row } = parseFogCellId(cellId)

    if (
      Number.isInteger(column) &&
      Number.isInteger(row) &&
      column >= 0 &&
      row >= 0 &&
      column < mapGrid.columns &&
      row < mapGrid.rows
    ) {
      remaining.add(`${column}:${row}`)
    }
  })

  const rects: FogRect[] = []

  for (let row = 0; row < mapGrid.rows; row += 1) {
    for (let column = 0; column < mapGrid.columns; column += 1) {
      const startKey = `${column}:${row}`

      if (!remaining.has(startKey)) {
        continue
      }

      let widthInCells = 1

      while (remaining.has(`${column + widthInCells}:${row}`)) {
        widthInCells += 1
      }

      let heightInCells = 1
      let canGrow = true

      while (canGrow && row + heightInCells < mapGrid.rows) {
        for (let offset = 0; offset < widthInCells; offset += 1) {
          if (!remaining.has(`${column + offset}:${row + heightInCells}`)) {
            canGrow = false
            break
          }
        }

        if (canGrow) {
          heightInCells += 1
        }
      }

      for (let yOffset = 0; yOffset < heightInCells; yOffset += 1) {
        for (let xOffset = 0; xOffset < widthInCells; xOffset += 1) {
          remaining.delete(`${column + xOffset}:${row + yOffset}`)
        }
      }

      rects.push({
        id: `${column}:${row}:${widthInCells}:${heightInCells}`,
        x: (column / mapGrid.columns) * 100,
        y: (row / mapGrid.rows) * 100,
        width: (widthInCells / mapGrid.columns) * 100,
        height: (heightInCells / mapGrid.rows) * 100,
      })
    }
  }

  return rects
}

export function getZoneFogRect(zone: {
  id: string
  x: number
  y: number
  width: number
  height: number
}) {
  return {
    id: zone.id,
    x: zone.x,
    y: zone.y,
    width: zone.width,
    height: zone.height,
  }
}
