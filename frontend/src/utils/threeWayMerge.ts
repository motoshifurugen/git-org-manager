// 3方向マージ判定＋親競合集約ロジックの共通関数
export function calcThreeWayMerge(baseNodes: any[], myNodes: any[], fetchedNodes: any[]) {
  function mapById(nodes: any[]) {
    const map: Record<string, any> = {}
    nodes.forEach(n => { map[n.id] = n })
    return map
  }
  function getNodePathForMap(node: any, nodeMap: Record<string, any>): string {
    if (!node) return ''
    const path: string[] = []
    let current = node
    while (current) {
      path.unshift(current.name)
      current = current.parentId ? nodeMap[current.parentId] : null
    }
    return path.join(' / ')
  }
  const baseMap = mapById(baseNodes)
  const myMap = mapById(myNodes)
  const fetchedMap = mapById(fetchedNodes)
  const allIds = Array.from(new Set([
    ...baseNodes.map(n => n.id),
    ...myNodes.map(n => n.id),
    ...fetchedNodes.map(n => n.id)
  ]))
  // まず競合候補をすべてリストアップ
  const allConflictsMap: Record<string, { id: string, base: any, local: any, remote: any }> = {}
  for (const id of allIds) {
    const base = baseMap[id]
    const local = myMap[id]
    const remote = fetchedMap[id]
    if (!base && !local && !remote) continue
    if (
      base && local && remote &&
      base.hash === local.hash && base.hash === remote.hash &&
      base.name === local.name && base.name === remote.name &&
      base.parentId === local.parentId && base.parentId === remote.parentId &&
      base.depth === local.depth && base.depth === remote.depth
    ) {
      continue
    }
    if (!allConflictsMap[id]) {
      allConflictsMap[id] = { id, base, local, remote }
    } else {
      if (base) allConflictsMap[id].base = base
      if (local) allConflictsMap[id].local = local
      if (remote) allConflictsMap[id].remote = remote
    }
  }
  const allConflicts: any[] = Object.values(allConflictsMap)
  const allConflictIds = new Set(allConflicts.map(c => c.base?.id || c.local?.id || c.remote?.id))
  function hasAncestorConflictById(node: any, nodeMap: Record<string, any>): boolean {
    let current = node
    while (current && current.parentId) {
      if (allConflictIds.has(current.parentId)) return true
      current = nodeMap[current.parentId]
    }
    return false
  }
  const allConflictsFiltered = allConflicts.filter(c => {
    const node = c.base || c.local || c.remote
    if (!node) return false
    if (hasAncestorConflictById(node, baseMap)) {
      if (c.base && c.local && (c.base.name !== c.local.name || c.base.hash !== c.local.hash)) return true
      if (c.base && c.remote && (c.base.name !== c.remote.name || c.base.hash !== c.remote.hash)) return true
      if (c.local && c.remote && (c.local.name !== c.remote.name || c.local.hash !== c.remote.hash)) return true
      return false
    }
    return true
  })
  function getNodeNameKey(node: any): string {
    return node?.name || ''
  }
  const nameKeyMap: Record<string, { base: any, local: any, remote: any, key: string }> = {}
  for (const c of allConflictsFiltered) {
    const baseKey = c.base ? getNodeNameKey(c.base) : ''
    const localKey = c.local ? getNodeNameKey(c.local) : ''
    const remoteKey = c.remote ? getNodeNameKey(c.remote) : ''
    const key = baseKey || localKey || remoteKey
    if (!nameKeyMap[key]) {
      nameKeyMap[key] = { base: c.base, local: c.local, remote: c.remote, key }
    } else {
      if (!nameKeyMap[key].base && c.base) nameKeyMap[key].base = c.base
      if (!nameKeyMap[key].local && c.local) nameKeyMap[key].local = c.local
      if (!nameKeyMap[key].remote && c.remote) nameKeyMap[key].remote = c.remote
    }
  }
  const mergedConflicts = Object.values(nameKeyMap)
  const filteredConflictsFinal = mergedConflicts.filter(c => c.local || c.remote)
  const allNodeMap = { ...baseMap, ...myMap, ...fetchedMap }
  let conflictIds = new Set<string>()
  function hasConflictAncestor(nodeId: string): boolean {
    let current = allNodeMap[nodeId]
    while (current && current.parentId) {
      if (conflictIds.has(current.parentId)) return true
      current = allNodeMap[current.parentId]
    }
    return false
  }
  const parentConflictIds = new Set<string>()
  const filteredConflicts: any[] = []
  for (const c of allConflictsFiltered) {
    const node = c.local || c.remote
    let skip = false
    let current = node
    while (current && current.parentId) {
      if (parentConflictIds.has(current.parentId)) {
        skip = true
        break
      }
      current = allNodeMap[current.parentId]
    }
    if (skip) continue
    filteredConflicts.push(c)
    if (c.local) parentConflictIds.add(c.local.id)
    if (c.remote) parentConflictIds.add(c.remote.id)
  }
  conflictIds = new Set(filteredConflicts.map(c => c.id))
  const autoMerged: any[] = []
  for (const id of allIds) {
    if (conflictIds.has(id)) continue
    if (hasConflictAncestor(id)) continue
    const base = baseMap[id]
    const local = myMap[id]
    const remote = fetchedMap[id]
    if (!base && local && !remote) {
      autoMerged.push(local)
      continue
    }
    if (!base && !local && remote) {
      autoMerged.push(remote)
      continue
    }
    if (!base && local && remote) {
      if (local.hash === remote.hash && local.name === remote.name && local.parentId === remote.parentId && local.depth === remote.depth) {
        autoMerged.push(local)
        continue
      }
    }
    if (base && local && remote) {
      const localChanged = base.hash !== local.hash || base.name !== local.name || base.parentId !== local.parentId || base.depth !== local.depth
      const remoteChanged = base.hash !== remote.hash || base.name !== remote.name || base.parentId !== remote.parentId || base.depth !== remote.depth
      if (localChanged && !remoteChanged) {
        autoMerged.push(local)
        continue
      } else if (!localChanged && remoteChanged) {
        autoMerged.push(remote)
        continue
      } else if (!localChanged && !remoteChanged) {
        continue
      } else if (localChanged && remoteChanged && (
        local.hash === remote.hash && local.name === remote.name && local.parentId === remote.parentId && local.depth === remote.depth
      )) {
        autoMerged.push(local)
        continue
      }
    }
  }
  return { autoMerged, conflicts: filteredConflictsFinal, allNodeMap, getNodePathForMap }
} 