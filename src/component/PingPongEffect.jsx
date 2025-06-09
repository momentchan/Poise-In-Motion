import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import { useRef, useMemo } from 'react'

export default function PingPongEffect({ blendFactor = 0.8 }) {
  const { gl, scene, camera, size } = useThree()

  // Framebuffers
  const fboSource = useFBO(size.width, size.height)
  const fboA = useFBO(size.width, size.height)
  const fboB = useFBO(size.width, size.height)
  const pingpong = useRef(true)

  // Fullscreen quad camera
  const quadCamera = useMemo(() => {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    cam.position.z = 1
    return cam
  }, [])

  // Shader material for blending
  const blendMaterial = useRef()
  const blendScene = useMemo(() => new THREE.Scene(), [])

  useMemo(() => {
    blendMaterial.current = new THREE.ShaderMaterial({
      uniforms: {
        current: { value: null },
        prev: { value: null },
        blendFactor: { value: blendFactor },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D current;
        uniform sampler2D prev;
        uniform float blendFactor;
        varying vec2 vUv;
        void main() {
          vec4 curr = texture2D(current, vUv);
          vec4 last = texture2D(prev, vUv);
          gl_FragColor = vec4(mix(curr.rgb, last.rgb, blendFactor), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blendMaterial.current)
    blendScene.add(quad)
  }, [blendFactor])

  // Output scene
  const outputMaterial = useRef()
  const outputScene = useMemo(() => new THREE.Scene(), [])

  useMemo(() => {
    outputMaterial.current = new THREE.MeshBasicMaterial({ map: null })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), outputMaterial.current)
    outputScene.add(quad)
  }, [])

  // Frame loop
  useFrame(() => {
    const prev = pingpong.current ? fboA : fboB
    const next = pingpong.current ? fboB : fboA

    // Step 1: Render main scene to source FBO
    gl.setRenderTarget(fboSource)
    gl.clear()
    gl.render(scene, camera)

    // Step 2: Update blend shader with current & previous frames
    blendMaterial.current.uniforms.current.value = fboSource.texture
    blendMaterial.current.uniforms.prev.value = prev.texture

    // Step 3: Blend to next FBO
    gl.setRenderTarget(next)
    gl.clear()
    gl.render(blendScene, quadCamera)

    // Step 4: Render final output to screen
    outputMaterial.current.map = next.texture
    gl.setRenderTarget(null)
    gl.clear()
    gl.render(outputScene, quadCamera)

    // Toggle ping-pong buffer
    pingpong.current = !pingpong.current
  }, 1)

  return null
}
