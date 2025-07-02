// hooks/useCustomFBX.js
import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import * as THREE from 'three'

export function useCustomFBX(path) {
  const loader = useMemo(() => {
    const manager = new THREE.LoadingManager()
    manager.setURLModifier((url) => {
      if (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg')) {
        // console.warn(`🛑 Texture load blocked: ${url}`)
        return '' 
      }
      return url
    })
    return new FBXLoader(manager)
  }, [])

  return useLoader(FBXLoader, path, (loaderInstance) => {
    loaderInstance.manager = loader.manager
  })
}
