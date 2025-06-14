import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import { useRef, useMemo, useEffect } from 'react'
import { useControls } from 'leva'

export default function PingPongEffect () {

  /* ───── Leva 參數 ───── */
  const { blendFactor, decay, delayFrames } = useControls('Ping Pong Effect', {
    blendFactor : { value: 0.4,  min: 0,   max: 1,    step: 0.01 },
    decay       : { value: 0.9, min: 0.0, max: 0.995,step: 0.001 },
    delayFrames : { value: 10,    min: 1,   max: 100,   step: 1    }
  })

  /* ───── R3F 基本物件 ───── */
  const { gl, scene, camera, size } = useThree()
  const fboSource = useFBO(size.width, size.height)              // 每幀最新畫面
  const trailA    = useFBO(size.width, size.height)              // ping
  const trailB    = useFBO(size.width, size.height)              // pong
  const useA      = useRef(true)                                 // ping-pong toggle
  const frameCnt  = useRef(0)

  /* ───── 共用的 Orthographic Camera & Quad 幾何 ───── */
  const quadCam = useMemo(() => {
    const c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    c.position.z = 1
    return c
  }, [])
  const quadGeo = useMemo(() => new THREE.PlaneGeometry(2, 2), [])

  /* === 1️⃣ Trail Pass (每 N 幀更新) ================== */
  const trailScene = useMemo(() => new THREE.Scene(), [])
  const trailMat   = useRef(null)

  useEffect(() => {
    trailMat.current = new THREE.ShaderMaterial({
      uniforms: {
        current:     { value: null },
        prev:        { value: null },
        decay:       { value: decay },
        blendFactor: { value: blendFactor }
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position,1.); }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D current;
        uniform sampler2D prev;
        uniform float decay;
        uniform float blendFactor;
        varying vec2 vUv;

        void main () {
          vec3 c = texture2D(current,vUv).rgb;
          vec3 p = texture2D(prev,   vUv).rgb * decay;
        //   gl_FragColor = vec4( mix(p, c, 1.0 - blendFactor), 1.0 );
          gl_FragColor = clamp(vec4(c + p, 1.0), 0.0, 1.0);
          
        //   gl_FragColor = vec4(c + p * (1.0 - blendFactor), 1.0); //vec4( mix(p, c, 1.0 - blendFactor), 1.0 );
        }
      `,
      depthTest:false, depthWrite:false
    })
    trailScene.add(new THREE.Mesh(quadGeo, trailMat.current))
  }, [])

  /* === 2️⃣ Display Pass (每幀更新) =================== */
  const displayScene = useMemo(() => new THREE.Scene(), [])
  const displayMat   = useRef(null)

  useEffect(() => {
    displayMat.current = new THREE.ShaderMaterial({
      uniforms:{
        current:{ value:null },
        trail  :{ value:null },
        blend  :{ value: blendFactor }
      },
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`,
      fragmentShader:/* glsl */`
        uniform sampler2D current;
        uniform sampler2D trail;
        uniform float blend;
        varying vec2 vUv;
        void main(){
          vec3 c = texture2D(current,vUv).rgb;
          vec3 t = texture2D(trail,  vUv).rgb;

          gl_FragColor = clamp(vec4(c + t * blend, 1.0), 0.0, 1.0);

        }
      `,
      depthTest:false, depthWrite:false
    })
    displayScene.add(new THREE.Mesh(quadGeo, displayMat.current))
  }, [])

  /* ───── Resize 時調整 FBO ───── */
  useEffect(() => {
    fboSource.setSize(size.width,size.height)
    trailA.setSize(size.width,size.height)
    trailB.setSize(size.width,size.height)
  }, [size])

  /* ───── Main Loop ───── */
  useFrame(() => {

    /* ----- 0. 最新場景 ➜ fboSource ----- */
    gl.setRenderTarget(fboSource)
    gl.clear()
    gl.render(scene, camera)

    /* ----- 1. Trail Pass：每 delayFrames 幀執行一次 ----- */
    frameCnt.current++
    if (frameCnt.current % delayFrames === 0) {
      const prev = useA.current ? trailA : trailB
      const next = useA.current ? trailB : trailA

      trailMat.current.uniforms.current.value = fboSource.texture
      trailMat.current.uniforms.prev.value    = prev.texture
      trailMat.current.uniforms.decay.value   = decay
      trailMat.current.uniforms.blendFactor.value = blendFactor

      gl.setRenderTarget(next)
      gl.clear()
      gl.render(trailScene, quadCam)

      useA.current = !useA.current        // 翻轉 ping-pong
    }

    /* ----- 2. Display Pass：每幀都執行 ----- */
    const trailTex = (useA.current ? trailA : trailB).texture
    displayMat.current.uniforms.current.value = fboSource.texture
    displayMat.current.uniforms.trail.value   = trailTex
    displayMat.current.uniforms.blend.value   = blendFactor

    gl.setRenderTarget(null)
    gl.clear()
    gl.render(displayScene, quadCam)
  }, 1)

  return null
}
