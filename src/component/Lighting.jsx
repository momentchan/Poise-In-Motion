import React, { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useControls, folder  } from 'leva'

export default function Lighting({ helper = false }) {
  const keyLightRef = useRef()
  const fillLightRef = useRef()
  const backLightRef = useRef()
  const upLightRef = useRef()
  const { scene } = useThree()

  // Leva controls for all light intensities
  const { keyLightEnabled, fillLightEnabled, backLightEnabled, upLightEnabled, ambientLightEnabled, keyLightIntensity, fillLightIntensity, backLightIntensity, ambientLightIntensity, upLightIntensity } = useControls('Lighting', {
    Lights: folder({
      keyLightEnabled: { value: true, label: 'Key Light' },
      fillLightEnabled: { value: true, label: 'Fill Light' },
      backLightEnabled: { value: true, label: 'Back Light' },
      upLightEnabled: { value: true, label: 'Up Light' },
      ambientLightEnabled: { value: true, label: 'Ambient Light' },
    }),
    Intensities: folder({
      keyLightIntensity: { value: 2, min: 0, max: 10, step: 0.01, label: 'Key Light Intensity' },
      fillLightIntensity: { value: 0.5, min: 0, max: 10, step: 0.01, label: 'Fill Light Intensity' },
      backLightIntensity: { value: 1.5, min: 0, max: 10, step: 0.01, label: 'Back Light Intensity' },
      upLightIntensity: { value: 2, min: 0, max: 10, step: 0.01, label: 'Up Light Intensity' },
      ambientLightIntensity: { value: 0.2, min: 0, max: 100, step: 0.01, label: 'Ambient Light Intensity' },
    }),
  }, { collapsed: true })

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
      if (upLightRef.current) {
        const h = new THREE.DirectionalLightHelper(upLightRef.current, 1, 'yellow')
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

  // Calculate actual intensities based on enabled state and individual light toggles
  const actualKeyIntensity = keyLightEnabled ? keyLightIntensity : 0
  const actualFillIntensity = fillLightEnabled ? fillLightIntensity : 0
  const actualBackIntensity = backLightEnabled ? backLightIntensity : 0
  const actualUpIntensity = upLightEnabled ? upLightIntensity : 0
  const actualAmbientIntensity = ambientLightEnabled ? ambientLightIntensity : 0
  return (
    <>
      {/* === Key Light ===
          Main directional light from the front-side/top-right.
          Provides main lighting and casts shadows.
      */}
      <directionalLight
        ref={keyLightRef}
        position={[5, 10, 5]}
        intensity={actualKeyIntensity}
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
        intensity={actualFillIntensity}
      />

      {/* === Back Light (Rim Light) ===
          Positioned behind and above the object.
          Creates edge highlights and adds depth.
      */}
      <directionalLight
        ref={backLightRef}
        position={[-5, 10, -5]}
        intensity={actualBackIntensity}
      />
      {/* === Up Light ===
          Light from above the object.
          Creates subtle highlights on the top surface.
      */}

      <directionalLight ref={upLightRef} position={[5, -10, 5]} intensity={actualUpIntensity} />
      {/* === Ambient Light ===
          Uniform ambient light for subtle base illumination.
      */}
      <ambientLight intensity={actualAmbientIntensity} />
    </>
  )
}
