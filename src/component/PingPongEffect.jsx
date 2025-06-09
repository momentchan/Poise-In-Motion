import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import { useRef, useMemo, useEffect } from 'react'
import { useControls } from 'leva'

export default function PingPongEffect({ }) {
    const { blendFactor } = useControls('Ping Pong Effect', {
        blendFactor: { value: 0.8, min: 0, max: 1, step: 0.01 }
    })

    const { gl, scene, camera, size } = useThree()

    const fboSource = useFBO(size.width, size.height)
    const fboA = useFBO(size.width, size.height)
    const fboB = useFBO(size.width, size.height)
    const pingpong = useRef(true)

    const quadCamera = useMemo(() => {
        const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
        cam.position.z = 1
        return cam
    }, [])

    // 混合 Shader 材質
    const blendMaterial = useRef()
    const blendScene = useMemo(() => new THREE.Scene(), [])

    useEffect(() => {
        blendMaterial.current = new THREE.ShaderMaterial({
            uniforms: {
                current: { value: null },
                prev: { value: null },
                blendFactor: { value: blendFactor }
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
    }, [])

    // 螢幕輸出材質
    const outputScene = useMemo(() => new THREE.Scene(), [])
    const outputMaterial = useRef()

    useEffect(() => {
        outputMaterial.current = new THREE.MeshBasicMaterial({ map: null })
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), outputMaterial.current)
        outputScene.add(quad)
    }, [])

    // 每幀更新
    useFrame(() => {
        const prev = pingpong.current ? fboA : fboB
        const next = pingpong.current ? fboB : fboA

        // Step 1: 將目前場景渲染到 source FBO
        gl.setRenderTarget(fboSource)
        gl.clear()
        gl.render(scene, camera)

        // Step 2: 更新混合 shader uniforms
        if (blendMaterial.current) {
            blendMaterial.current.uniforms.current.value = fboSource.texture
            blendMaterial.current.uniforms.prev.value = prev.texture
            blendMaterial.current.uniforms.blendFactor.value = blendFactor // ✨ 每幀同步 leva
        }

        // Step 3: 混合至 next FBO
        gl.setRenderTarget(next)
        gl.clear()
        gl.render(blendScene, quadCamera)

        // Step 4: 將結果畫到螢幕或 debug view
        if (outputMaterial.current) {
            outputMaterial.current.map = next.texture
        }
        gl.setRenderTarget(null)
        gl.clear()
        gl.render(outputScene, quadCamera)

        pingpong.current = !pingpong.current
    }, 1)

    return null
}
