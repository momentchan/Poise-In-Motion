/* PingPongEffectBloom.jsx */
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import { useRef, useMemo, useEffect } from 'react'
import { useControls } from 'leva'

export default function PingPongEffect () {
  /* --- GUI ------------------------------------------------------ */
  const { blendFactor, decay, delayFrames,
          bloomThreshold, bloomIntensity, blurStep } =
    useControls('Ping-pong Bloom', {
      blendFactor    : { value:0.4, min:0,   max:1,   step:0.01 },
      decay          : { value:0.9, min:0.0, max:0.995,step:0.001 },
      delayFrames    : { value:10,  min:1,   max:100, step:1 },
      bloomThreshold : { value:0.7, min:0,   max:1,   step:0.01 },
      bloomIntensity : { value:1.2, min:0,   max:3,   step:0.05 },
      blurStep       : { value:1.0, min:0.3, max:3,   step:0.1 }
    })

  /* --- R3F context --------------------------------------------- */
  const { gl, scene, camera, size } = useThree()
  const fboSource = useFBO(size.width, size.height)   // live scene
  const trailA    = useFBO(size.width, size.height)
  const trailB    = useFBO(size.width, size.height)
  const displayRT = useFBO(size.width, size.height)   // mix result
  const brightRT  = useFBO(size.width, size.height)
  const blurA     = useFBO(size.width, size.height)
  const blurB     = useFBO(size.width, size.height)

  const useA      = useRef(true)
  const frameCnt  = useRef(0)

  /* --- full-screen quad stuff ---------------------------------- */
  const quadCam = useMemo(() => new THREE.OrthographicCamera(-1,1,1,-1,0,1),[])
  const quadGeo = useMemo(() => new THREE.PlaneGeometry(2,2),[])

  /* === 1. trail pass =========================================== */
  const trailMat = useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{
      current:{value:null}, prev:{value:null},
      decay:{value:decay}, blendFactor:{value:blendFactor}
    },
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);} `,
    fragmentShader:/* glsl */`
      uniform sampler2D current,prev; uniform float decay,blendFactor;
      varying vec2 vUv;
      void main(){
        vec3 c = texture2D(current,vUv).rgb;
        vec3 p = texture2D(prev   ,vUv).rgb*decay;
        gl_FragColor = clamp(vec4(c+p,1.),0.,1.);
      }`,
    depthTest:false, depthWrite:false
  }),[])

  const trailScene = useMemo(()=>new THREE.Scene().add(
    new THREE.Mesh(quadGeo, trailMat)),[])

  /* === 2. bright-pass ========================================== */
  const brightMat = useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{ src:{value:null}, thresh:{value:bloomThreshold} },
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);} `,
    fragmentShader:/* glsl */`
      uniform sampler2D src; uniform float thresh; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(src,vUv).rgb;
        float l = max(max(c.r,c.g),c.b);
        gl_FragColor = vec4(l>thresh?c:vec3(0.),1.);
      }`,
    depthTest:false, depthWrite:false
  }),[])

  const brightScene = useMemo(()=>new THREE.Scene().add(
    new THREE.Mesh(quadGeo, brightMat)),[])

  /* === 3. Kawase blur ========================================== */
  const blurMat = useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{ src:{value:null}, offset:{value:new THREE.Vector2()} },
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);} `,
    fragmentShader:/* glsl */`
      uniform sampler2D src; uniform vec2 offset; varying vec2 vUv;
      void main(){
        vec3 s = texture2D(src,vUv).rgb*0.294;
        s += texture2D(src,vUv+offset).rgb*0.353;
        s += texture2D(src,vUv-offset).rgb*0.353;
        gl_FragColor = vec4(s,1.);
      }`,
    depthTest:false, depthWrite:false
  }),[])

  const blurScene = useMemo(()=>new THREE.Scene().add(
    new THREE.Mesh(quadGeo, blurMat)),[])

  /* === 4. display mix & final composite ======================== */

  // 4-A  mix current + trail  --> displayRT
  const mixMat = useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{ current:{value:null}, trail:{value:null}, blend:{value:blendFactor} },
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);} `,
    fragmentShader:/* glsl */`
      uniform sampler2D current,trail; uniform float blend; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(current,vUv).rgb;
        vec3 t = texture2D(trail  ,vUv).rgb;
        gl_FragColor = clamp(vec4(c+t*blend,1.),0.,1.);
      }`,
    depthTest:false, depthWrite:false
  }),[])

  const mixScene = useMemo(()=>new THREE.Scene().add(
    new THREE.Mesh(quadGeo, mixMat)),[])

  // 4-B  final composite  displayRT + bloom  --> screen
  const finalMat = useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{
      base :{value:null},
      bloom:{value:null},
      intensity:{value:bloomIntensity}
    },
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);} `,
    fragmentShader:/* glsl */`
      uniform sampler2D base,bloom; uniform float intensity; varying vec2 vUv;
      void main(){
        vec3 baseColor = texture2D(base ,vUv).rgb;
        vec3 bloomColor = texture2D(bloom,vUv).rgb*intensity;

        // vec3 col = baseColor;// + bloomColor;
        vec3 col = bloomColor;
        col = baseColor + bloomColor;



        gl_FragColor = vec4(clamp(col,0.,1.),1.);
      }`,
    depthTest:false, depthWrite:false
  }),[])

  const finalScene = useMemo(()=>new THREE.Scene().add(
    new THREE.Mesh(quadGeo, finalMat)),[])

  /* === Resize --------------------------------------------------- */
  useEffect(()=>{
    const {width,height}=size
    ;[fboSource,trailA,trailB,displayRT,brightRT,blurA,blurB]
      .forEach(r=>r.setSize(width,height))
  },[size])

  /* === Frame loop ============================================== */
  useFrame(()=>{

    /* 0. render main scene ------------------------------------- */
    gl.setRenderTarget(fboSource)
    gl.clear(); gl.render(scene,camera)

    /* 1. update trail every N frames --------------------------- */
    frameCnt.current++
    if(frameCnt.current%delayFrames===0){
      const prev = useA.current?trailA:trailB
      const next = useA.current?trailB:trailA

      trailMat.uniforms.current.value = fboSource.texture
      trailMat.uniforms.prev.value    = prev.texture
      trailMat.uniforms.decay.value   = decay
      trailMat.uniforms.blendFactor.value=blendFactor

      gl.setRenderTarget(next)
      gl.clear(); gl.render(trailScene,quadCam)
      useA.current=!useA.current
    }
    const trailTex=(useA.current?trailA:trailB).texture

    /* 2. mix scene + trail ---> displayRT ---------------------- */
    mixMat.uniforms.current.value = fboSource.texture
    mixMat.uniforms.trail.value   = trailTex
    mixMat.uniforms.blend.value   = blendFactor
    gl.setRenderTarget(displayRT)
    gl.clear(); gl.render(mixScene,quadCam)

    /* 3. bright-pass ------------------------------------------ */
    brightMat.uniforms.src.value    = displayRT.texture
    brightMat.uniforms.thresh.value = bloomThreshold
    gl.setRenderTarget(brightRT)
    gl.clear(); gl.render(brightScene,quadCam)

    /* 4. two-tap Kawase blur ---------------------------------- */
    const stepX = blurStep/size.width , stepY = blurStep/size.height

    blurMat.uniforms.src.value    = brightRT.texture
    blurMat.uniforms.offset.value.set(stepX,0)
    gl.setRenderTarget(blurA)
    gl.clear(); gl.render(blurScene,quadCam)

    blurMat.uniforms.src.value    = blurA.texture
    blurMat.uniforms.offset.value.set(0,stepY)
    gl.setRenderTarget(blurB)
    gl.clear(); gl.render(blurScene,quadCam)

    /* 5. composite to screen ---------------------------------- */
    finalMat.uniforms.base.value      = displayRT.texture
    finalMat.uniforms.bloom.value     = blurB.texture
    finalMat.uniforms.intensity.value = bloomIntensity

    gl.setRenderTarget(null)
    gl.clear(); gl.render(finalScene,quadCam)
  },1)

  return null
}
