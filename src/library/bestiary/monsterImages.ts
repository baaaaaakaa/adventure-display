import type { MonsterBlock } from '../../types/adventure'

export type MonsterImageRef =
  | { kind: 'none' }
  | { kind: 'public'; src: string }
  | { kind: 'project-asset'; assetId: string; src?: string | null }
  | { kind: 'local-object-url'; src: string }
  | { kind: 'remote'; src: string }

export function getMonsterImageRef(monster: Pick<MonsterBlock, 'imageAssetId' | 'imageSrc'>): MonsterImageRef {
  if (monster.imageAssetId) {
    return { kind: 'project-asset', assetId: monster.imageAssetId, src: monster.imageSrc }
  }

  const src = monster.imageSrc?.trim()

  if (!src) {
    return { kind: 'none' }
  }

  if (src.startsWith('blob:') || src.startsWith('data:')) {
    return { kind: 'local-object-url', src }
  }

  if (/^https?:\/\//i.test(src)) {
    return { kind: 'remote', src }
  }

  return { kind: 'public', src }
}
