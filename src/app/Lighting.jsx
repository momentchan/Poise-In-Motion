import React, { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useControls } from 'leva'

export default function Lighting({ helper = false }) {
  const keyLightRef = useRef()
  const fillLightRef = useRef()
  const backLightRef = useRef()
  const { scene } = useThree()

  // Leva controls for all light intensities
  const { keyLightIntensity, fillLightIntensity, backLightIntensity, ambientLightIntensity } = useControls('Lighting', {
    keyLightIntensity: { value: 2.0, min: 0, max: 10, step: 0.01, label: 'Key Light Intensity' },
    fillLightIntensity: { value: 0.5, min: 0, max: 10, step: 0.01, label: 'Fill Light Intensity' },
    backLightIntensity: { value: 1.0, min: 0, max: 10, step: 0.01, label: 'Back Light Intensity' },
    ambientLightIntensity: { value: 0.2, min: 0, max: 10, step: 0.01, label: 'Ambient Light Intensity' },
  })

  useEffect(() => {
    const helpers = []
    if (helper) {
      if (keyLightRef.current) {
        const h = new THREE.DirectionalLightHelper(keyLightRef.current, 1, 'red')
        scene.add(h)
        helpers.push(h)
      }
      if (fillLightRef.current) {
        const h = new THREE.DirectionalLightHelper(fillLightRef.current, 1, 'blue')
        scene.add(h)
        helpers.push(h)
      }
      if (backLightRef.current) {
        const h = new THREE.DirectionalLightHelper(backLightRef.current, 1, 'green')
        scene.add(h)
        helpers.push(h)
      }
    }
    return () => {
      helpers.forEach(h => {
        scene.remove(h)
        h.dispose && h.dispose()
      })
    }
  }, [helper, scene])

  return (
    <>
      {/* === Key Light ===
          Main directional light from the front-side/top-right.
          Provides main lighting and casts shadows.
      */}
      <directionalLight
        ref={keyLightRef}
        position={[5, 10, 5]}
        intensity={keyLightIntensity}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* === Fill Light ===
          Soft light to reduce harsh shadows.
          Positioned on the opposite side of the key light.
      */}
      <directionalLight
        ref={fillLightRef}
        position={[-3, 5, 2]}
        intensity={fillLightIntensity}
      />

      {/* === Back Light (Rim Light) ===
          Positioned behind and above the object.
          Creates edge highlights and adds depth.
      */}
      <directionalLight
        ref={backLightRef}
        position={[-5, 10, -5]}
        intensity={backLightIntensity}
      />

      {/* === Ambient Light ===
          Uniform ambient light for subtle base illumination.
      */}
      <ambientLight intensity={ambientLightIntensity} />
    </>
  )
}
