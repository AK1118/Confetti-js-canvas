# Confetti-js-canvas
canvas中奖庆祝礼花喷发特效

#引入对象
首先需要从.js文件中引入喷发对象和渲染对象
import {ConfettoEjector,CanvasRender} from './js/index.js';

#创建渲染对象CanvasRender
const canvasRender = new CanvasRender();
		canvasRender.init({
			el: "#canvas",
			displayFps:true,
			onFinished:()=>{
			}
		});
    canvasRender.run();
当然也可以直接在init函数后面链式调用.run();

#init函数可以接受多个参数
init({
		el,//required [String] canvas节点id
		vm,//uniapp的vm this对象，h5不需要加
		width,//canvas的宽度
		height,//canvas的高度
		displayFps,//是否显示fps，仅仅H5支持。如果设置为ture,那您最好有一个id为confps的标签供他innerHtml。
		paint,//自己设置canvas的2d画笔对象
		onFinished,//动画执行完毕回调()=>{}
	});
  
 #喷发对象ConfettoEjector
  喷发对象需要您传入两个必要的参数才能正常工作
  const pao=new ConfettoEjector(canvasRender,{});
  可以看到其中一个是上面创建的canvasRender,这样可以让渲染对象更好的管理喷发出来的特效对象，达到对象的重复利用。
  另外一个对像有三个参数供您填写{
		limitAngle,//[Array]  喷发角度限制[min,max],值域在0-360之间，您可以尝试一下。对了，顺时针。
		count,//[Number] 每次喷发出来的对象数量，建议在100以内。
		shapeTypes,//[Array] 喷发出来的形状，默认可以不设置。[3, 4, 5, 6, 15],以上我提交了三角形，四边形，五边形等
	}
  
 #创建一个boom,蓄势待发。
  const boom=pao.create({
				x:0,//required [Number] 喷发圆心点X轴
				y:0,//required [Number] 喷发圆心点Y轴
				clampforce:[20, 100],//[Array] 喷发力度区间
			});      
  值得注意的是，boom是一个Promise对象，并没有被渲染，我们还需要把这个boom给他fire出去。
  
  #fire掉这个boom,让礼花砰~
  pao.fire(boom);
  
 #注意事项
  1.CanvasRender可以被多个喷发对象使用，但一个喷发对象只能设置一个CanvasRender。
  2.一个canvas标签只能被一个CanvasRender所拥有，如果您有两个canvas标签，不妨为它再多new一个CanvasRender对象。
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
