import bpy, math, sys, os
argv = sys.argv[sys.argv.index("--")+1:]
IMG, OUT, N, RES, AMAX = argv[0], argv[1], int(argv[2]), int(argv[3]), float(argv[4])
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x = sc.render.resolution_y = RES
sc.render.film_transparent = True
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'
img = bpy.data.images.load(IMG)
def mat(name, dark):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; N_ = nt.nodes; L = nt.links
    for n in list(N_): N_.remove(n)
    out = N_.new('ShaderNodeOutputMaterial')
    tex = N_.new('ShaderNodeTexImage'); tex.image = img; tex.interpolation = 'Cubic'
    col = tex.outputs['Color']
    if dark:
        mul = N_.new('ShaderNodeMixRGB'); mul.blend_type = 'MULTIPLY'; mul.inputs[0].default_value = 1
        L.new(col, mul.inputs[1]); mul.inputs[2].default_value = (0.32, 0.25, 0.16, 1); col = mul.outputs[0]
    em = N_.new('ShaderNodeEmission'); L.new(col, em.inputs['Color']); em.inputs['Strength'].default_value = 0.55 if not dark else 0.5
    pb = N_.new('ShaderNodeBsdfPrincipled'); L.new(col, pb.inputs['Base Color'])
    pb.inputs['Metallic'].default_value = 0.85; pb.inputs['Roughness'].default_value = 0.38
    if not dark:
        bw = N_.new('ShaderNodeRGBToBW'); L.new(tex.outputs['Color'], bw.inputs[0])
        bump = N_.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.55; bump.inputs['Distance'].default_value = 0.02
        L.new(bw.outputs[0], bump.inputs['Height']); L.new(bump.outputs['Normal'], pb.inputs['Normal'])
    add = N_.new('ShaderNodeAddShader'); L.new(em.outputs[0], add.inputs[0]); L.new(pb.outputs[0], add.inputs[1])
    tr = N_.new('ShaderNodeBsdfTransparent')
    thr = N_.new('ShaderNodeMath'); thr.operation = 'GREATER_THAN'; thr.inputs[1].default_value = 0.5
    L.new(tex.outputs['Alpha'], thr.inputs[0])
    mix = N_.new('ShaderNodeMixShader'); L.new(thr.outputs[0], mix.inputs[0]); L.new(tr.outputs[0], mix.inputs[1]); L.new(add.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs['Surface'])
    return m
top, side = mat('top', False), mat('side', True)
root = bpy.data.objects.new('root', None); sc.collection.objects.link(root)
LAYERS, DEPTH = 18, 0.075
for i in range(LAYERS + 1):
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, -DEPTH * i / LAYERS))
    o = bpy.context.active_object; o.data.materials.append(top if i == 0 else side); o.parent = root
cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = 2.32
cam = bpy.data.objects.new('cam', cam_d); cam.location = (0, 0, 10); sc.collection.objects.link(cam); sc.camera = cam
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.045, 0.04, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1
for nm, loc, e, col in [('key', (-3, 4, 6), 900, (1, .9, .72)), ('rim', (4, -3, 3), 300, (.75, .8, 1))]:
    ld = bpy.data.lights.new(nm, 'AREA'); ld.energy = e; ld.size = 3; ld.color = col
    lo = bpy.data.objects.new(nm, ld); lo.location = loc; sc.collection.objects.link(lo)
    tc = lo.constraints.new('TRACK_TO'); tc.target = root
os.makedirs(OUT, exist_ok=True)
h = (N - 1) / 2
for r in range(N):
    for c in range(N):
        ax = (r - h) / h * AMAX   # row: tilt top away (+) / toward
        ay = (c - h) / h * AMAX
        root.rotation_euler = (math.radians(ax), math.radians(ay), 0)
        sc.render.filepath = os.path.join(OUT, f"f_{r}_{c}.png")
        bpy.ops.render.render(write_still=True)
print("DONE")
