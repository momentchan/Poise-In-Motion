import { CameraControls } from "@react-three/drei";
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import Utilities from "../r3f-gist/utility/Utilities";
import { CustomShaderMaterial } from "../r3f-gist/shader/CustomShaderMaterial";
import fragmentShader from "../shader/test/fragment.glsl";
import { useControls } from 'leva'
import PingPongEffect from "../component/PingPongEffect";
import FullScreenRedEffect from "../component/FullScreenRedEffect";

function BasicMesh() {
    const materialRef = useRef()
    const meshRef = useRef()    

    const { alpha } = useControls('Torus Material', {
        alpha: {
            value: 1,
            min: 0,
            max: 1,
            step: 0.01
        }
    })

    useFrame(() => {
        meshRef.current.rotation.y += 0.01
    })

    return (
        <mesh ref={meshRef}>
            <planeGeometry args={[2, 2]} />
            <CustomShaderMaterial
                ref={materialRef}
                fragmentShader={fragmentShader}
                uniforms={{
                    uAlpha: alpha,
                }}
                transparent={true}
                side={2}
            />
        </mesh>
    )
}


export default function App() {
    return <>
        <Canvas
            shadows
            camera={{
                fov: 45,
                near: 0.1,
                far: 200,
                position: [4, 2, 6]
            }}
            gl={{ preserveDrawingBuffer: true }}
        >
            <color attach="background" args={['#ffffff']} />
            <CameraControls makeDefault />
            <BasicMesh />
            {/* <FullScreenRedEffect /> */}
            <PingPongEffect />
            <Utilities />
        </Canvas>
    </>
}