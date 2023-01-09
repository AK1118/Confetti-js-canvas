class ScreenUtil {
	static width;
	static height;
}
class AnimationState {
	static running = Symbol.for("running");
	static stop = Symbol.for("stop");
};
/*渲染管理器*/
class CanvasRender {
	/*纸屑回收站*/
	#revoveryShape = [];
	/*纸屑集合*/
	#shapeList = [];
	/*el对象*/
	canvas;
	/*画笔*/
	#paint;
	/*动画控制器*/
	animationController;
	/*是否uniapp*/
	#isUni = false;
	/*动画是否还在更新中*/
	#animationState = AnimationState.stop;
	/*显示fps*/
	displayFps;
	#hasBeenDispose = false;
	/*Fps工具*/
	#fpsUtil = {
		sampleSize: 60,
		value: 0,
		_sample_: [],
		_index_: 0,
		_lastTick_: false,
		tick: function() {
			// if is first tick, just set tick timestamp and return
			if (!this._lastTick_) {
				this._lastTick_ = performance.now();
				return 0;
			}
			// calculate necessary values to obtain current tick FPS
			let now = performance.now();
			let delta = (now - this._lastTick_) / 1000;
			let fps = 1 / delta;
			// add to fps samples, current tick fps value 
			this._sample_[this._index_] = Math.round(fps);

			// iterate samples to obtain the average
			let average = 0;
			for (let i = 0; i < this._sample_.length; i++) average += this._sample_[i];

			average = Math.round(average / this._sample_.length);

			// set new FPS
			this.value = average;
			// store current timestamp
			this._lastTick_ = now;
			// increase sample index counter, and reset it
			// to 0 if exceded maximum sampleSize limit
			this._index_++;
			if (this._index_ === this.sampleSize) this._index_ = 0;
			return this.value;
		}
	};
	/*动画执行完毕回调*/
	onFinished;
	init({
		el,
		vm,
		width,
		height,
		displayFps,
		paint,
		onFinished,
	}) {
		if (el == undefined) {
			return;
		}
		this.displayFps = displayFps || false;
		this.onFinished = onFinished || function() {};
		try {
			this.#isUni = uni != undefined;
		} catch (e) {}
		if (document) {
			this.canvas = document.querySelector(el);
		} else if (wx) {
			this.canvas = wx.createSelectorQuery().select(el);
		}
		if (paint) {
			this.#paint = paint;
		} else this.#setPaint(el, vm, width, height);
		return this;
	}
	#setPaint(el, vm, width, height) {
		if (this.#isUni) {
			this.#paint = uni.createCanvasContext(el, vm);
			let getWindowInfo = uni.getWindowInfo();
			ScreenUtil.width = getWindowInfo.windowWidth;
			ScreenUtil.height = getWindowInfo.windowHeight;
		} else if (this.canvas.getContext) {
			this.#paint = this.canvas.getContext("2d");
			ScreenUtil.width = window.innerWidth;
			ScreenUtil.height = window.innerHeight;
			this.canvas.width = width || ScreenUtil.width;
			this.canvas.height = height || ScreenUtil.height;
		}
	}
	run() {
		if (this.#hasBeenDispose) {
			return console.error("This CanvasRender has been destroyed!");
		}
		const animationEngine = requestAnimationFrame || function(fn) {
			return setTimeout(fn, 1000 / 60)
		};
		animationEngine(() => {
			if (this.#shapeList.length != 0)
				this.#update(animationEngine);
		});
	}
	dispose() {
		this.#hasBeenDispose = true;
		this.#animationState = AnimationState.stop;
		this.#paint = this.canvas = this.#shapeList = this.#revoveryShape = this.#fpsUtil = null;
	}
	/**
	 * 刷新Canvas,每帧检测回收对象
	 */
	#update(animationEngine) {
		if (this.#isUni) {
			this.#paint.draw();
		} else {
			this.#paint.clearRect(0, 0, ScreenUtil.width, ScreenUtil.height);
		}
		/*检测对象数量及时停止*/
		if (this.#shapeList.length == 0) return this.#animationFinished();
		
		{	
				  /*canvas宽度一半*/
			const _half_w=ScreenUtil.width >>1,
				  /*canvas高度一半*/
				  _half_h=ScreenUtil.height >>1;
			/*更新动画*/
			this.#shapeList.forEach(
				(shape,ndx) => {
					/*位置超出视口标记为可回收对象*/
					shape.alive = (shape.position.x < _half_w && shape.position.x > ~_half_w) && shape
						.position.y < _half_h;
					if (!shape.alive) {
						return;
					}
					shape.update(this.#paint);
				}
			);
		}
		/*回收对象*/
		this.#recovery();
		/*计算显示FPS*/
		if (this.displayFps) {
			const fps = this.#fpsUtil.tick();
			if (document) {
				document.querySelector("#confps").innerHTML = `Shape:${this.#shapeList.length}/FPS:${fps}`;
			}
		}
		/*判断动画是否还继续*/
		if (this.#animationState == AnimationState.stop) return;
		/*下一次更新调用*/
		this.animationController = animationEngine(() => {
			this.#update(animationEngine);
		});
	}
	#animationFinished() {
		this.#animationState = AnimationState.stop;
		this.onFinished();
	}
	/**
	 * @description 回收彩纸对象
	 */
	#recovery() {
		this.#shapeList = this.#shapeList.filter((item, ndx) => {
			if (!item.alive) {
				this.#revoveryShape.push(item);
			}
			return item.alive;
		});
	}
	/**
	 * @description 在回收栈里面拿重复利用对象
	 * @param {number} count //拿多少个
	 */
	async recover(count) {
		if (this.#hasBeenDispose) {
			throw new Error('This CanvasRender has been destroyed!')
		}
		const len = this.#revoveryShape.length;
		if (count > len) {
			const re = [];
			for (let i = 0; i < len; i++) {
				re.push(this.#revoveryShape.pop());
			}
			return Promise.resolve(re);
		} else {
			const re = [];
			for (let i = 0; i < count; i++) {
				re.push(this.#revoveryShape.pop());
			}
			return Promise.resolve(re);
		}
		return Promise.resolve([])
	}
	add(shapes) {
		/*fire的时候继续开启动画状态*/
		if (this.#animationState == AnimationState.stop) {
			this.#animationState = AnimationState.running;
			this.run();
		}
		this.#shapeList.push(...shapes);
	}
}

class Vector {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}
	add(v) {
		this.x += v.x;
		this.y += v.y;
		return this;
	}

	sub(v) {
		this.x -= v.x;
		this.y -= v.y;
		return this;
	}
	mult(v) {
		this.x *= v.x;
		this.y *= v.y;
		return this;
	}
	div(v) {
		this.x /= v.x;
		this.y /= v.y;
		return this;
	}
	mag() {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}
	dist(v) {
		let dx = this.x - v.x;
		let dy = this.y - v.y;
		return Math.sqrt(dx * dx + dy * dy);
	}
	normalize() {
		let len = this.mag();
		this.x /= len;
		this.y /= len;
		return this;
	}
	clamp(c) {
		let [max, min] = c;
		this.x = Math.min(Math.max(this.x, min), max)
		this.y = Math.min(Math.max(this.y, min), max)
	}
	copy() {
		return new Vector(this.x, this.y);
	}
	set(v) {
		this.x = v.x;
		this.y = v.y;
	}
	setXY(x, y) {
		this.x = x;
		this.y = y;
	}
	static dist(v1, v2) {
		let sub = Vector.sub(v1, v2);
		return Vector.mag(sub);
	}
	static mag(v) {
		return Math.sqrt(v.x * v.x + v.y * v.y);
	}
	static sub(v1, v2) {
		return new Vector(v1.x - v2.x, v1.y - v2.y);
	}
}

/*材质*/
class Material {
	points = [];
	opacity = 1;
	draw(paint) {}
}

/*面*/
class Plane extends Material {
	A = new Point({
		x: 0,
		y: 0,
		z: 1000000
	});
	color = Styles.RandomColor;
	constructor(points) {
		super();
		this.points = points;
	}
	update(paint, position, shape) {
		if (this.opacity <= 0.05) {
			return shape.alive = false;
		}
		this.opacity -= .004;
		this.draw(paint, position);
	}
	draw(paint, position) {
		paint.beginPath();
		this.color[3] = this.opacity;
		paint.fillStyle = Styles.rgba(this.color);
		this.points.forEach(point => {
			const dp = Matrix3.transformTo2D(point, this.A, position);
			paint.lineTo(dp.x, dp.y);
		})
		paint.closePath();
		paint.fill();
	}
}
/*矩阵工具类*/
class Matrix3 {
	static transformTo2D(point, A, position = new Vector(0, 0)) {
		//const scale=3//A.z/(A.z+point.z);
		// const x = scale*point.x;
		// const y =  scale*point.y;
		const pz = 1 / (A.z - point.z);
		const x = ((point.x - A.x) * A.z) * pz;
		const y = ((point.y - A.y) * A.z) * pz;
		return {
			x: x + ScreenUtil.width * .5 + position.x,
			y: y + ScreenUtil.height * .5 + position.y,
		};
	}
	static rotateX(point, angle) {
		const mp = point.toArray();
		const cos_ = Math.cos(angle),
			sin_ = Math.sin(angle);
		const y = point.y * cos_ - point.z * sin_;
		const z = point.z * cos_ + point.y * sin_;
		const result = [point.x, y, z];
		// const mf = [
		// 	[1, 0, 0],
		// 	[0, cos_, (sin_*-1)],
		// 	[0, sin_, cos_]
		// ];
		return result;
	}
	static rotateZ(point, angle) {
		const mp = point.toArray();
		const cos_ = Math.cos(angle),
			sin_ = Math.sin(angle);

		const x = point.x * cos_ - point.y * sin_;
		const y = point.x * sin_ + point.y * cos_;

		return [x, y, point.z];
		// const mf = [
		// 	[cos_, (sin_*-1) , 0],
		// 	[sin_, cos_, 0],
		// 	[0, 0, 1]
		// ];
	}
	static rotateY(point, angle) {
		const mp = point.toArray();
		const cos_ = Math.cos(angle),
			sin_ = Math.sin(angle);
		const x = point.x * cos_ - point.z * sin_;
		const z = point.z * cos_ + point.x * sin_;
		return [x, point.y, z];
	}

}

/*喷发类*/
class ConfettoEjector {
	gravity = 0.08;
	/*彩纸片边角数量集合*/
	shapeTypes = [3, 4, 15];
	//限制喷射角度，顺时针
	limitAngle = [90, 270];

	canvasRender;

	PI = Math.PI / 180;
	/*每次爆炸彩纸数量*/
	count = 30;
	constructor(canvasRender, {
		limitAngle,
		count,
		shapeTypes
	}) {
		if (canvasRender == undefined) {
			return console.error("CanvasRender不能为空")
		}
		this.canvasRender = canvasRender;
		this.limitAngle = limitAngle || [0, 360];
		this.count = count || 30;
		this.shapeTypes = shapeTypes || [3, 4, 5, 6, 15];
	}
	/*获取指定区间值*/
	getRandomClamp([min, max]) {
		const ran = Math.random() * (max - min + 1) + min;
		return ran;
	}
	async create({
		/*喷发圆心点x*/
		x,
		/*喷发圆心点y*/
		y,
		/*喷发力度域值[min,max]*/
		clampforce,
		/*纸屑半径*/
		radius,
	}) {
		//喷射速度
		const spraySpeed = clampforce || [20, 40];
		const shapesCache = [];
		/*重新使用被回收的对象*/
		const recover = await this.canvasRender.recover(this.count);
		const len = recover.length;
		for (let i = 0; i < len; i++) {
			const shape = recover[i];
			const ranAngle = this.getRandomClamp(this.limitAngle) * this.PI;
			const speed = this.getRandomClamp(spraySpeed);
			const vx = Math.cos(ranAngle) * speed;
			const vy = Math.sin(ranAngle) * speed;
			shape.reset({
				position: {
					x,
					y
				},
				vector: {
					x: vx,
					y: vy
				}
			});
		}
		shapesCache.push(...recover);
		for (let i = 0; i < this.count - len; i++) {
			const count = this.shapeTypes[~~(Math.random() * this.shapeTypes.length)];
			const ranAngle = this.getRandomClamp(this.limitAngle) * this.PI;
			const speed = this.getRandomClamp(spraySpeed);
			const vx = Math.cos(ranAngle) * speed;
			const vy = Math.sin(ranAngle) * speed;
			const shape = new Polygon({
				width: radius||12,
				count: count,
				position: new Vector(x, y),
				vector: new Vector(vx, vy)
			});
			shapesCache.push(shape)
		}
		return Promise.resolve(shapesCache);
	}
	async fire(_shapes) {
		const shapes = await _shapes;
		this.shapesCache = [];
		this.canvasRender.add(shapes);
	}
}
class Point extends Vector {
	constructor({
		x = 0,
		y = 0,
		z = 0
	}) {
		super();
		this.x = x;
		this.y = y;
		this.z = z;
		this.position = new Vector(0, 0);
	}
	toArray() {
		return [this.x, this.y, this.z];
	}
	set([x, y, z]) {
		this.x = x;
		this.y = y;
		this.z = z;
	}
}
class Matrix3All {
	/**
	 * @param {Shape} shape
	 */
	static PI = Math.PI / 180;
	static rotateX(shape, angle) {
		shape.points.forEach(item => {
			item.set(Matrix3.rotateX(item, Matrix3All.PI * angle));
		});
	}
	static rotateY(shape, angle) {
		shape.points.forEach(item => {
			item.set(Matrix3.rotateY(item, Matrix3All.PI * angle));
		});
	}
	static rotateZ(shape, angle) {
		shape.points.forEach(item => {
			item.set(Matrix3.rotateZ(item, Matrix3All.PI * angle));
		});
	}
}

class Shape {
	points = [];
	material;
	position = new Vector(0, 0);
	vector = new Vector(0, 0);
	alive = true;
	id = new Date().toString();
	constructor() {

	}
	update() {}
	reset({
		position,
		vector
	}) {
		this.alive = true;
		this.material.opacity = 1;
		this.position.setXY(position.x, position.y);
		this.vector.setXY(vector.x, vector.y);
	}
}

/*自定义角的数量*/
class Polygon extends Shape {
	constructor({
		width = 10,
		height = 10,
		material,
		position,
		count = 3,
		vector
	}) {
		super();
		this.width = width;
		this.height = height;
		this.createPoints(count);
		//现在的位置
		this.position = position || new Vector(0, 0);
		//上一次位置
		this.bposition = this.position.copy();
		this.vector = vector || new Vector(0, 0);
		this.material = material || new Plane(this.points);
		this.z = 0;
		//this.turn=Math.random()>.5?1:-1;
	}
	createPoints(count) {
		const PI = Math.PI <<1;
		const half_w=this.width>>1;
		for (let i = 0; i < count; i++) {
			this.points.push(new Point({
				x: Math.cos(i * PI / count) * half_w,
				y: Math.sin(i * PI / count) * half_w,
				z: this.z,
			}));
		}
	}
	setZ(z) {
		this.z = z;
		this.points.forEach(item => {
			item.z = this.z;
		})
	}
	move() {
		if (Math.abs(this.vector.x) > .2) this.vector.x *= .9;
		if (Math.abs(this.vector.y) > 1) this.vector.y *= .9;
		this.vector.y += .26;
		this.vector.x += Math.random() > .5 ? -.2 : .2;
		this.position.add(this.vector)

	}
	update(paint) {
		this.move();
		this.material.update(paint, this.position, this);
		const speed = 20 //*this.turn;
		Matrix3All.rotateX(this, Math.random() * speed - this.vector.y);
		Matrix3All.rotateY(this, Math.random() * speed - this.vector.x)
		Matrix3All.rotateZ(this, Math.random() * speed - this.vector.y)
	}
}
class Styles {
	static get RandomColor() {
		const colors = [
			[253, 101, 255],
			[163, 253, 130],
			[183, 128, 253],
			[89, 214, 255],
			[253, 186, 96],
			[251, 253, 113],
		]
		const ran = ~~(Math.random() * colors.length);
		const color = colors[ran];
		return color;
	}
	static rgba([r, g, b, a]) {
		return `rgba(${r},${g},${b},${a})`;
	}
}


export {
	ConfettoEjector,
	CanvasRender
};
