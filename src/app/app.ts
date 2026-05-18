import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, OnDestroy, signal, afterNextRender, PLATFORM_ID, Inject, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { indentWithTab } from '@codemirror/commands';
import { linter, Diagnostic, lintGutter } from '@codemirror/lint';
import { foldService, syntaxTree, foldAll, unfoldAll, foldCode, unfoldCode } from '@codemirror/language';

// Linter to find syntax errors from the lezer tree
const syntaxLinter = linter((view) => {
  const diagnostics: Diagnostic[] = [];
  syntaxTree(view.state).cursor().iterate((node) => {
    if (node.type.isError) {
      diagnostics.push({
        from: node.from,
        to: node.to,
        severity: "error",
        message: "Syntax error",
      });
    }
  });
  return diagnostics;
});

// Extension to fold parenthesized expressions
const parenFold = foldService.of((state: EditorState, lineStart: number, lineEnd: number) => {
  const tree = syntaxTree(state);
  let foldRange: { from: number; to: number } | null = null;

  tree.iterate({
    from: lineStart,
    to: lineEnd,
    enter: (node) => {
      // Find if we are entering an ArgList or ParenthesizedExpression that starts on this line
      if (node.from >= lineStart && node.from <= lineEnd) {
        if (node.name === 'ParenthesizedExpression' || node.name === 'ArgList') {
          const endLine = state.doc.lineAt(node.to);
          const startLine = state.doc.lineAt(node.from);
          // Only fold if the block spans multiple lines
          if (endLine.number > startLine.number) {
            foldRange = { from: node.from + 1, to: node.to - 1 };
            return false; // Stop iterating
          }
        }
      }
      return true;
    }
  });

  return foldRange;
});

// Functional Geometry Primitives and Transforms
export type FunGeoObject = THREE.Object3D;

export const cube = (size = 1): FunGeoObject => {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshStandardMaterial({ wireframe: true, color: 0x888888 });
  return new THREE.Mesh(geometry, material);
};

export const sphere = (radius = 0.5): FunGeoObject => {
  const geometry = new THREE.SphereGeometry(radius, 16, 16);
  const material = new THREE.MeshStandardMaterial({ wireframe: true, color: 0x888888 });
  return new THREE.Mesh(geometry, material);
};

export const cylinder = (radiusTop = 0.5, radiusBottom = 0.5, height = 1): FunGeoObject => {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16);
  const material = new THREE.MeshStandardMaterial({ wireframe: true, color: 0x888888 });
  return new THREE.Mesh(geometry, material);
}

export const group = (...objs: FunGeoObject[]): FunGeoObject => {
  const g = new THREE.Group();
  objs.forEach(o => {
    g.add(o.clone());
  });
  return g;
};

export const translate = (x: number, y: number, z: number) => (obj: FunGeoObject): FunGeoObject => {
  const g = new THREE.Group();
  g.add(obj.clone());
  g.position.set(x, y, z);
  return g;
};
export const move = translate;
export const moveX = (x: number) => translate(x,0,0);
export const moveY = (y: number) => translate(0,y,0);
export const moveZ = (z: number) => translate(0,0,z);

export const scale = (sx: number, sy: number, sz: number) => (obj: FunGeoObject): FunGeoObject => {
  const g = new THREE.Group();
  g.add(obj.clone());
  g.scale.set(sx, sy, sz);
  return g;
};
export const scaleX = (x: number) => scale(x,1,1);
export const scaleY = (y: number) => scale(1,y,1);
export const scaleZ = (z: number) => scale(1,1,z);
export const sc = (k: number) => scale(k,k,k);

export const rotate = (rx: number, ry: number, rz: number) => (obj: FunGeoObject): FunGeoObject => {
  const g = new THREE.Group();
  g.add(obj.clone());
  g.rotation.set(rx, ry, rz);
  return g;
};

export const paint = (rgb: [number, number, number]) => (obj: FunGeoObject): FunGeoObject => {
  const cloned = obj.clone();
  cloned.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.material) {
        mesh.material = (mesh.material as THREE.Material).clone();
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.color = new THREE.Color(rgb[0], rgb[1], rgb[2]);
        material.wireframe = false;
      }
    }
  });
  return cloned;
};

const DEFAULT_CODE = `
/*
  Build a 3D model using Functional Geometry
  Available primitives:
    cube()
    sphere()
    cylinder()
  Available transforms:
    translate(x,y,z)
    scale(x,y,z)
    rotate(x,y,z)
    paint([r,g,b])
  Combine with: group(obj1, obj2, ...)
*/

const head = (
  (paint ([1, 0.8, 0.6])
    (sphere (0.5)))
)
const body = (
  (paint ([0.2, 0.2, 0.8])
    (translate (0, -1, 0)
      (cube (1))))
)
const armL = (
  (paint ([1, 0.8, 0.6])
    (translate (-0.8, -0.8, 0)
      (scale (0.3, 1.2, 0.3)
        (cube (1)))))
)
const armR = (
  (paint ([1, 0.8, 0.6])
    (translate (0.8, -0.8, 0)
      (scale (0.3, 1.2, 0.3)
        (cube (1)))))
)
const legL = (
  (paint ([0.2, 0.2, 0.2])
    (translate (-0.3, -2, 0)
      (scale (0.4, 1, 0.4)
        (cube (1)))))
)
const legR = (
  (paint ([0.2, 0.2, 0.2])
    (translate (0.3, -2, 0)
      (scale (0.4, 1, 0.4)
        (cube (1)))))
)

return (
  group (head, body, armL, armR, legL, legR)
)
`.trim();

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host ::ng-deep .cm-editor {
      height: 100%;
      outline: none;
    }
    :host ::ng-deep .cm-scroller::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    :host ::ng-deep .cm-scroller::-webkit-scrollbar-track {
      background: #0F0F12;
    }
    :host ::ng-deep .cm-scroller::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 5px;
      border: 2px solid #0F0F12;
    }
    :host ::ng-deep .cm-scroller::-webkit-scrollbar-thumb:hover {
      background: #475569;
    }
  `],
  template: `
    <div class="flex flex-col h-screen w-full bg-[#0F0F12] text-slate-200 font-sans overflow-hidden">
      <main class="flex-1 flex overflow-hidden lg:flex-row flex-col relative" [class.select-none]="isDragging()" [class.cursor-col-resize]="isDragging()">
        <!-- Sidebar -->
        <div class="flex flex-col bg-[#16161A] shrink-0 h-full"
             [style.width.px]="sidebarWidth()">
          <div class="flex-1 flex flex-col pt-4 bg-[#0F0F12] overflow-hidden">
            <div class="px-4 mb-2 flex justify-between items-end">
              <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Geometry Script</label>
              <span class="text-[10px] text-slate-600 font-mono">JavaScript</span>
            </div>
            <div #editorContainer class="flex-1 w-full overflow-hidden text-[13px] bg-[#282c34]"></div>
          </div>
          
          <div class="p-4 border-t border-slate-800 bg-[#16161A] flex justify-between items-center gap-2">
            <div class="text-xs text-red-500 font-mono flex-1 overflow-hidden" [title]="error()">
              <div class="truncate">{{ error() }}</div>
            </div>
            <button 
              (click)="evaluateCode()"
              class="px-4 py-1.5 shrink-0 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors active:scale-95"
            >
               Render Model <span class="text-blue-200 ml-1 opacity-70 text-[10px]">(Alt+Enter)</span>
            </button>
          </div>
        </div>
        
        <!-- Draggable Handle -->
        <div class="w-1 cursor-col-resize bg-slate-800 hover:bg-blue-500 transition-colors z-10 shrink-0"
             [class.bg-blue-500]="isDragging()"
             (mousedown)="startDrag($event)"></div>
        
        <!-- Viewer -->
        <div class="flex-1 relative bg-[#1A1B20] overflow-hidden" [class.pointer-events-none]="isDragging()">
          <div #canvasContainer class="absolute inset-0 cursor-move"></div>
          
        </div>
      </main>
      
    </div>
  `
})
export class App implements OnInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef<HTMLDivElement>;
  
  sidebarWidth = signal(420);
  isDragging = signal(false);

  code = signal(DEFAULT_CODE);
  error = signal('');


  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private userModelGroup!: THREE.Group;
  private animationId = 0;
  private resizeObserver!: ResizeObserver;
  private editorView!: EditorView;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    afterNextRender(() => {
      this.initEditor();
      this.initThreeJs();
      this.evaluateCode();
    });
  }

  startDrag(event: MouseEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  @HostListener('window:mousemove', ['$event'])
  onDrag(event: MouseEvent) {
    if (!this.isDragging()) return;
    const newWidth = Math.max(200, Math.min(event.clientX, window.innerWidth - 300));
    this.sidebarWidth.set(newWidth);
  }

  @HostListener('window:mouseup')
  stopDrag() {
    this.isDragging.set(false);
  }

  ngOnInit() {
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      if (this.editorView) {
        this.editorView.destroy();
      }
      cancelAnimationFrame(this.animationId);
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
      if (this.renderer) {
        this.renderer.dispose();
      }
    }
  }

  private initEditor() {
    const parentContainer = this.editorContainer.nativeElement;
    
    this.editorView = new EditorView({
      state: EditorState.create({
        doc: this.code(),
        extensions: [
          basicSetup,
          keymap.of([
            indentWithTab,
            { key: 'Alt-a', run: foldAll },
            { key: 'Alt-q', run: unfoldAll },
            { key: 'Ctrl-ArrowUp', run: foldCode },
            { key: 'Ctrl-ArrowDown', run: unfoldCode },
            {
              key: 'Alt-Enter',
              preventDefault: true,
              run: () => {
                this.evaluateCode();
                return true;
              }
            }
          ]),
          javascript(),
          syntaxLinter,
          lintGutter(),
          parenFold,
          oneDark,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.code.set(update.state.doc.toString());
            }
          })
        ]
      }),
      parent: parentContainer
    });
  }

  private initThreeJs() {
    const container = this.canvasContainer.nativeElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x09090b); // zinc-950
    // Add some fog for depth
    this.scene.fog = new THREE.FogExp2(0x09090b, 0.05);

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(5, 3, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-10, 10, -10);
    this.scene.add(backLight);
    
    // Grid Helper
    const grid = new THREE.GridHelper(20, 20, 0x27272a, 0x18181b); // zinc-800, zinc-900
    grid.position.y = -3;
    this.scene.add(grid);

    // Group for user model
    this.userModelGroup = new THREE.Group();
    this.scene.add(this.userModelGroup);

    // Handle resizing
    this.resizeObserver = new ResizeObserver(() => {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    });
    this.resizeObserver.observe(container);

    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  evaluateCode() {
    this.error.set('');
    try {
      // Clear previous model
      while(this.userModelGroup.children.length > 0){ 
        const child = this.userModelGroup.children[0];
        this.userModelGroup.remove(child); 
      }

      // Create a function that provides our primitives in its scope
      const createModel = new Function(
        'cube', 'sphere', 'cylinder',
        'group',
        'translate', 'move', 'moveX', `moveY`, 'moveZ',
        'scale', 'sc', 'scaleX', 'scaleY', 'scaleZ',
        'rotate',
        'paint',
        this.code()
      );

      const result = createModel(
        cube, sphere, cylinder,
        group,
        translate, move, moveX, moveY, moveZ,
        scale, sc, scaleX, scaleY, scaleZ,
        rotate,
        paint
      );

      if (result instanceof THREE.Object3D) {
        this.userModelGroup.add(result);
      } else {
        this.error.set('Script must return an Object.');
      }
    } catch (e: any) {
      console.error(e);
      this.error.set(e.message || 'Execution error');
    }
  }
}
