import { useAnimations, useFBX, useTexture } from "@react-three/drei";
import * as THREE from 'three'
import { act, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useControls } from "leva";
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

export default function Model({ path, pos, scale = 1 }) {

    const fbx = useFBX(path)

    const { ref, actions, names } = useAnimations(fbx.animations);
    const index = 0

    const {
        baseColor,
        fresnelColor,
        fresnelPower,
        // Physical Material Properties
        roughness,
        metalness,
        clearcoat,
        clearcoatRoughness,
        transmission,
        thickness,
        attenuationDistance,
        attenuationColor,
        ior,
        reflectivity,
        sheen,
        sheenRoughness,
        sheenColor,
        specularIntensity,
        specularColor,
        iridescence,
        iridescenceIOR,
        iridescenceThicknessRange
    } = useControls('Model Shader', {
        baseColor: { value: '#ffffff', label: 'Base Color' },
        fresnelColor: { value: '#ffffff', label: 'Fresnel Color' },
        fresnelPower: { value: 2.0, min: 0.1, max: 5.0, step: 0.1, label: 'Fresnel Power' },
        // Physical Material Properties
        roughness: { value: 1, min: 0, max: 1, step: 0.01, label: 'Roughness' },
        metalness: { value: 1, min: 0, max: 1, step: 0.01, label: 'Metalness' },
        clearcoat: { value: 0.83, min: 0, max: 1, step: 0.01, label: 'Clearcoat' },
        clearcoatRoughness: { value: 1, min: 0, max: 1, step: 0.01, label: 'Clearcoat Roughness' },
        transmission: { value: 1, min: 0, max: 1, step: 0.01, label: 'Transmission' },
        thickness: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'Thickness' },
        attenuationDistance: { value: 0.9, min: 0, max: 1, step: 0.01, label: 'Attenuation Distance' },
        attenuationColor: { value: '#ffffff', label: 'Attenuation Color' },
        ior: { value: 1.5, min: 1, max: 2.33, step: 0.01, label: 'IOR' },
        reflectivity: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'Reflectivity' },
        sheen: { value: 1.0, min: 0, max: 1, step: 0.01, label: 'Sheen' },
        sheenRoughness: { value: 1.0, min: 0, max: 1, step: 0.01, label: 'Sheen Roughness' },
        sheenColor: { value: '#ffffff', label: 'Sheen Color' },
        specularIntensity: { value: 1, min: 0, max: 1, step: 0.01, label: 'Specular Intensity' },
        specularColor: { value: '#ffffff', label: 'Specular Color' },
        iridescence: { value: 1, min: 0, max: 1, step: 0.01, label: 'Iridescence' },
        iridescenceIOR: { value: 2.3, min: 1, max: 2.33, step: 0.01, label: 'Iridescence IOR' },
        iridescenceThicknessRange: { value: [100, 400], min: 0, max: 1000, step: 1, label: 'Iridescence Thickness Range' }
    })
    
    const currentAction = useRef(null)
    useEffect(() => {
        const action = actions[names[index]];
        action.play()
        currentAction.current = action
    }, [ actions, names])

    const material = useMemo(() => {
        let mat = new CustomShaderMaterial({
            baseMaterial: THREE.MeshPhysicalMaterial,
            uniforms: {
                uBaseColor: { value: new THREE.Color(baseColor) },
                uFresnelColor: { value: new THREE.Color(fresnelColor) },
                uFresnelPow: { value: fresnelPower },
                uRatio: { value: 0 }
            },
            fragmentShader: /* glsl */`
            uniform vec3  uBaseColor;
            uniform vec3  uFresnelColor;
            uniform float uFresnelPow;
            uniform float uRatio;
      
            void main() {
                vec3 N = normalize( vNormal );
                vec3 V = normalize( vViewPosition );   
      
                float fresnel = pow(1.0 - max(dot(N, V), 0.0), uFresnelPow);
                vec3  color   = mix(uBaseColor, uFresnelColor, fresnel);

                float ratio = smoothstep(0.0, 0.02, uRatio) * smoothstep(1.0, 0.98, uRatio); 
                //   color = V;
                  csm_DiffuseColor = vec4(color, fresnel * ratio);
                // csm_DiffuseColor.a *= fresnel * ratio;

            }
          `, silent: true,
            // Physical Material Properties
            roughness: roughness,
            metalness: metalness,
            clearcoat: clearcoat,
            clearcoatRoughness: clearcoatRoughness,
            transmission: transmission,
            thickness: thickness,
            attenuationDistance: attenuationDistance,
            attenuationColor: new THREE.Color(attenuationColor),
            ior: ior,
            reflectivity: reflectivity,
            sheen: sheen,
            sheenRoughness: sheenRoughness,
            sheenColor: new THREE.Color(sheenColor),
            specularIntensity: specularIntensity,
            specularColor: new THREE.Color(specularColor),
            iridescence: iridescence,
            iridescenceIOR: iridescenceIOR,
            iridescenceThicknessRange: iridescenceThicknessRange,
            transparent: true,
            side: THREE.FrontSide,
            // wireframe: true,
            depthWrite: false,
        })

        // mat = new THREE.MeshBasicMaterial({
        //     color: 0x00ff00,
        //     side: THREE.FrontSide,
        //     transparent: true,
        //     opacity: 0.5,
        // })

        return mat;
    }, []);


    const depthMat = useMemo(() => new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: true,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
    }), [])

    /* ───── 3. 在 FBX 載入完成後，只做一次 depthCopy ───── */
    useEffect(() => {
        if (!fbx) return                 // 模型尚未載入

        const DEPTH_TAG = Symbol('depthCopy')

        fbx.traverse(child => {
            if (!child.isMesh) return

            /* 主透明材質：每次進 effect 都可更新 */
            child.material = material
            child.renderOrder = 1
            child.frustumCulled = false

            /* 若還沒有 depthCopy → 建立一次並標記 */
            if (!child.userData[DEPTH_TAG]) {

                // ① 建立適當的 depthCopy（含骨架綁定）
                const copy = child.isSkinnedMesh
                    ? (() => {
                        const sk = new THREE.SkinnedMesh(child.geometry, depthMat)
                        sk.bind(child.skeleton, child.bindMatrix)
                        return sk
                    })()
                    : new THREE.Mesh(child.geometry, depthMat)

                // ② 幾何平滑（只做一次）
                if (!child.geometry.index) {
                    //   child.geometry = mergeVertices(child.geometry, 1e-4)
                    //   child.geometry.computeVertexNormals()
                }

                copy.renderOrder = 0
                copy.frustumCulled = false
                child.parent.add(copy)
                child.userData[DEPTH_TAG] = copy        // 標籤，避免重複
            }
        })
    }, [fbx, depthMat])

    function findBone(root, regex) {
        let found = null;
        root.traverse(o => {
            if (o.isBone && regex.test(o.name)) found = o;
        });
        return found;
    }
    

    useFrame((state, delta) => {

        if (!currentAction.current) return;

        // three r148+ 有 getClip()；舊版可用 _clip
        const clip = currentAction.current.getClip ? currentAction.current.getClip() : currentAction.current._clip;
        const dur = clip.duration;              // 秒
        const norm = (currentAction.current.time % dur) / dur;  // 0–1


        if (material) {
            material.uniforms.uBaseColor.value.set(baseColor)
            material.uniforms.uFresnelColor.value.set(fresnelColor)
            material.uniforms.uFresnelPow.value = fresnelPower
            material.uniforms.uRatio.value = norm
            // Update physical material properties
            material.roughness = roughness
            material.metalness = metalness
            material.clearcoat = clearcoat
            material.clearcoatRoughness = clearcoatRoughness
            material.transmission = transmission
            material.thickness = thickness
            material.attenuationDistance = attenuationDistance
            material.attenuationColor.set(attenuationColor)
            material.ior = ior
            material.reflectivity = reflectivity
            material.sheen = sheen
            material.sheenRoughness = sheenRoughness
            material.sheenColor.set(sheenColor)
            material.specularIntensity = specularIntensity
            material.specularColor.set(specularColor)
            material.iridescence = iridescence
            material.iridescenceIOR = iridescenceIOR
            material.iridescenceThicknessRange = iridescenceThicknessRange
        }
    })

    return (
        <group ref={ref} position={pos} onClick={() => { if (blendRate === 0 || blendRate === 1) setIndex((index + 1) % names.length) }}>
            <primitive scale={scale} object={fbx} />
        </group>

    )
}