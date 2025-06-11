import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import { useRef, useMemo, useEffect } from 'react'
import { useControls } from 'leva'

export default function PingPongEffect({ }) {
    // Control for blending between current and previous frames
    const { blendFactor, progress } = useControls('Ping Pong Effect', {
        blendFactor: { value: 0.9, min: 0.01, max: 1, step: 0.01 },
        progress: { value: 0, min: 0, max: 1, step: 0.01 }
    })

    // Get Three.js context
    const { gl, scene, camera, size } = useThree()

    // Create Frame Buffer Objects (FBOs) for ping-pong rendering
    const fboSource = useFBO(size.width, size.height)  // Source buffer for current frame
    const fboA = useFBO(size.width, size.height)      // First ping-pong buffer
    const fboB = useFBO(size.width, size.height)      // Second ping-pong buffer
    const pingpong = useRef(true)                      // Toggle between buffers

    // Create orthographic camera for full-screen quad rendering
    const quadCamera = useMemo(() => {
        const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
        cam.position.z = 1
        return cam
    }, [])

    // Blend shader material for mixing current and previous frames
    const blendMaterial = useRef()
    const blendScene = useMemo(() => new THREE.Scene(), [])

    useEffect(() => {
        // Create shader material for blending frames
        blendMaterial.current = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                current: { value: null },    // Current frame texture
                prev: { value: null },       // Previous frame texture
                blendFactor: { value: blendFactor },  // Blend amount
                progress: { value: 0 }
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
                uniform float time;
                uniform float progress;

                varying vec2 vUv;

                void main() {
                    float PI = 3.14159265358979323846;
                    vec2 uv = vUv;
                    uv -= 0.5;
                    uv /= 2.0;
                    // uv.y += progress;
                    uv.x += sin(uv.y * PI * 4. + time * 0.3) * 0.15;
                    uv.x += sin(uv.y * PI * 16. + time * 0.1) * 0.15;

                    uv += 0.5;

                    uv = mix(vUv, uv, progress);

                    vec4 curr = texture2D(current, uv);
                    vec4 last = texture2D(prev, vUv);
                    gl_FragColor = vec4(mix(curr.rgb, last.rgb, blendFactor), 1.0);
                }
            `,
            depthTest: false,
            depthWrite: false,
        })

        // Create full-screen quad for blending
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blendMaterial.current)
        blendScene.add(quad)
    }, [])

    // Output scene for final rendering
    const outputScene = useMemo(() => new THREE.Scene(), [])
    const outputMaterial = useRef()

    useEffect(() => {
        // Create material for final output
        outputMaterial.current = new THREE.MeshBasicMaterial({ map: null })
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), outputMaterial.current)
        outputScene.add(quad)
    }, [])

    // Frame update loop
    useFrame((state) => {
        // Determine which buffers to use for ping-pong
        const prev = pingpong.current ? fboA : fboB
        const next = pingpong.current ? fboB : fboA

        // Step 1: Render current scene to source FBO
        gl.setRenderTarget(fboSource)
        gl.clear()
        gl.render(scene, camera)

        // Step 2: Update blend shader uniforms
        if (blendMaterial.current) {
            blendMaterial.current.uniforms.time.value = state.clock.elapsedTime
            
            blendMaterial.current.uniforms.current.value = fboSource.texture
            blendMaterial.current.uniforms.prev.value = prev.texture
            blendMaterial.current.uniforms.blendFactor.value = blendFactor // Update from leva controls
            blendMaterial.current.uniforms.progress.value = progress
        }

        // Step 3: Blend frames into next FBO
        gl.setRenderTarget(next)
        gl.clear()
        gl.render(blendScene, quadCamera)

        // Step 4: Render final result to screen
        if (outputMaterial.current) {
            outputMaterial.current.map = next.texture
        }
        gl.setRenderTarget(null)
        gl.clear()
        gl.render(outputScene, quadCamera)

        // Toggle ping-pong state
        pingpong.current = !pingpong.current
    }, 1)

    return null
}
