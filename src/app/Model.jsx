import { useFBX } from "@react-three/drei";
import { useFrame } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { useControls } from 'leva'
import * as THREE from 'three'

// Custom shader material for normal visualization
const NormalShaderMaterial = {
    uniforms: {
        time: { value: 0 },
        intensity: { value: 1.0 }
    },
    vertexShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
    
            gl_FragColor = vec4(vNormal, 1.0);
            gl_FragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);
        }
    `
};

export default function Model() {
    const materialRef = useRef()
    const meshRef = useRef()
    const fbx = useFBX('/free_head.fbx')
    const groupRef = useRef()

    const { intensity } = useControls('Normal Material', {
        intensity: {
            value: 1.0,
            min: 0.0,
            max: 2.0,
            step: 0.1
        }
    });

    useEffect(() => {
        const material = new THREE.ShaderMaterial({
            ...NormalShaderMaterial,
            side: THREE.DoubleSide
        });
        // const material = new THREE.MeshNormalMaterial();
        
        // Create a bounding box for the entire FBX model
        const boundingBox = new THREE.Box3().setFromObject(fbx)
        const center = boundingBox.getCenter(new THREE.Vector3())
        
        // Center the model by offsetting its position
        fbx.position.x = -center.x
        fbx.position.y = -center.y
        fbx.position.z = -center.z

        fbx.traverse((child) => {
            if (child.isMesh) {
                child.material = material;
                // Ensure normals are properly calculated
                // child.geometry.computeVertexNormals();
            }
        });
    }, []);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.time.value = state.clock.elapsedTime;
            materialRef.current.uniforms.intensity.value = intensity;
        }
    });

    return (
        <group ref={groupRef} position={[0, 0, 0]}>
            <primitive scale={0.1} object={fbx} />
        </group>
    )
}
