import bpy

TEMPLATE_FILE = '''{{
	"exporter_version": [0,0,1],
	"faces": [{0}],
	"vertices": [{1}],
	"uv": [{2}],
	"vertex_groups": {{{3}}},
	"bones": [{4}],
	"animations": {{{5}}}
}}'''

TEMPLATE_FACE = '''{{"z":{z},"vertices":[{vertices}]}}'''

TEMPLATE_VERTEX_GROUP = '''"{0}":[{1}]
'''

TEMPLATE_BONE = '''{{"name":"{0}","head":[{1}],"children":[{3}]}}'''

TEMPLATE_ANIMATION = '''"{name}":{{"length":{length}, "curves":{{{curves}}}}}'''

TEMPLATE_ANIMATION_BONE = '''"{name}":[{curves}]
'''
TEMPLATE_CURVE = '''{{"type":["{type}",{array_index}], "keys":[{keyframes}]}}
'''

TEMPLATE_KEYFRAME = '''[{frame},{value},[{handle_left}],[{handle_right}]]'''

def bones_string(armature):
	bones_list = []
	def bone_string(bone):
		children = []
		for c in bone.children:
			children.append(bone_string(c))
		'''
			export parent bones head in global space, childrens relative to parent
			head_local means 'head location in armature space'
			couldn't find any variable for loc related to parent so just subtract parent head_local from child head_local
		'''
		head = bone.head_local
		if bone.parent:
			head = head - bone.parent.head_local
		else:
			head = head + armature.location
		rotation = bone.matrix.to_quaternion()
		#mirror y-axis, cross your fingers
		rotation[0]*=-1; rotation[1]*=-1
		return TEMPLATE_BONE.format(bone.name, str(head[0])+','+str(-head[1]) ,','.join(children))
	for bone in armature.data.bones:
		if not bone.parent:
			bones_list.append(bone_string(bone))
	return ','.join(bones_list)

def animations_string(armature):
	animations_list = []
	for track in armature.animation_data.nla_tracks:
		if len(track.strips) < 1:
			continue
		last_frame = track.strips[len(track.strips)-1].frame_end
		bones={}
		#strips and keyframes are always sorted
		for strip in track.strips:
			for bone in strip.action.groups:
				for curve in bone.channels:
					type = curve.data_path.rsplit('.', 1)[1]
					if type == 'rotation_quaternion':
						type = 'q'
					elif type == 'location':
						type = 'l'
					elif type == 'scale':
						type = 's'
					else:
						print('unsupported curve type (euler or something)')
					keyframes = []
					for keyframe in curve.keyframe_points:
						value = keyframe.co[1]
						handle_left = keyframe.handle_left.copy()
						handle_right = keyframe.handle_right.copy()
						#mirror y-axis, cross your fingers
						if type == 'q' and (curve.array_index == 0 or curve.array_index == 1):
							value *= -1
							handle_left[1] *= -1
							handle_right[1] *= -1
						if type == 'l' and curve.array_index == 1:
							value *= -1
						handle_left[0] += strip.frame_start
						handle_right[0] += strip.frame_start
						
						keyframes.append(TEMPLATE_KEYFRAME.format(frame=keyframe.co[0] + strip.frame_start, value=value, handle_left=','.join(map(lambda x: str(x), handle_left)), handle_right=','.join(map(lambda x: str(x), handle_right))))
					#get curves of correct type&array_index (if exists) and extend keyframes
					bones.setdefault(bone.name, {}).setdefault(type, {}).setdefault(curve.array_index, []).extend(keyframes)
		print(len(bones))
		bone_strings = []		
		for bone_name in bones.keys():
			curves = []
			bone = bones[bone_name]
			for curve_type in bone.keys():
				for array_index in bone[curve_type].keys():
					curves.append(TEMPLATE_CURVE.format(type=curve_type, array_index=array_index, keyframes=','.join(bone[curve_type][array_index])))
			bone_strings.append(TEMPLATE_ANIMATION_BONE.format(name=bone_name, curves=','.join(curves)))
			
		animations_list.append(TEMPLATE_ANIMATION.format(name=track.name, length=last_frame, curves=','.join(bone_strings) ))
	return ','.join(animations_list)

def write(filepath):
	bpy.ops.object.mode_set(mode='OBJECT')
	out = open(filepath, "w")
	
	armature = False
	object = False
	mesh = False
	
	# if only one object is selected
	if len(bpy.context.selected_objects) == 1:
		tmp = bpy.context.selected_objects[0]
		#if selected object is mesh
		if tmp.type == 'MESH':
			object = tmp
			mesh = tmp.data
			if tmp.parent and tmp.parent.type == 'ARMATURE':
				armature = tmp.parent
		#if selected object is armature and has only one child
		elif tmp.type == 'ARMATURE':
			if len(tmp.children) == 1:
				armature = tmp
				object = armature.children[0]
				mesh = object.data
	#if could not init object from selection just pick first mesh in data
	if not object:
		for o in bpy.data.objects:
			if o.type == 'MESH':
				object = o
				mesh = o.data
				if o.parent:
					armature = o.parent
				break
	
	vertex_groups = []
	for g in range(0, len(object.vertex_groups)):
		vertex_groups.append([])
	
	str_list = []
	for face in mesh.polygons:
		z = 0
		vertices = []
		for v in face.vertices:
			z = z + mesh.vertices[v].co[2]
			vertices.append(str(v))
		z = z/len(vertices)
		str_list.append(TEMPLATE_FACE.format(z=str(z), vertices= ','.join(vertices)))
	faces = ','.join(str_list)
	
	str_list = []
	for vertex in mesh.vertices:
		coord = vertex.co + object.matrix_world.to_translation()
		str_list.append(str(coord[0]))
		str_list.append(str(-coord[1]))
		for group in vertex.groups:
			vertex_groups[group.group].append([vertex.index, group.weight])
	vertices = ','.join(str_list)
	
	str_list = []
	for v in mesh.uv_layers[0].data:
		str_list.append(str(v.uv[0]))
		str_list.append(str(1-v.uv[1]))
	uv = ','.join(str_list)
	
	str_list = []
	for group in object.vertex_groups:
		group_str_list = []
		for vertex in vertex_groups[group.index]:
			group_str_list.append(str(vertex))
		str_list.append(TEMPLATE_VERTEX_GROUP.format(group.name, ','.join(group_str_list)))
	vertex_groups = ','.join(str_list)
	
	bones = ''
	animations = ''
	if armature:
		bones = bones_string(armature)
		animations = animations_string(armature)
	out.write(TEMPLATE_FILE.format(faces, vertices, uv, vertex_groups, bones, animations))
	out.close()
