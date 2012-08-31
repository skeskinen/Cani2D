Cani2D
======

Javascript canvas skeletal animation library.

Purpose of this library is to provide easy-to-use skeletal animation system to your HTML5 canvas works.
With skeletal animations you can have your animations running at any framerate without having to think about memory or bandwidth.

Current release: v0.0.1, 

Whats working right now:
	Loading and drawing models.
	Bone rotations.
	Playing an animation.
	Bezier interpolation between keyframes.

Part of the package is Blender exporter that can be used to make your own animations. 
Few notes about the Blender exporter:
	Currently for version 2.63.
	Use 'Top Ortho' view, positive y up, positive x right.
	You have to have uv map and texture for your model, there is no "basic material".
	One NLA track is one animation. Actions are not animations.

Possible improvements:
	Python exporter is a mess.
	Way to swap parts of the model (for facial expressions and stuff).
	Multiple animations at the same time.
	Improving(?) and documenting the model .json format.
	Performance improvements.
	Getting rid of for ... in loops.
	Documentation & examples.
	A lot of other stuff.

