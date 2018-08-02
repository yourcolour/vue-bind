// el是挂载的id选择器,或者挂载的dom
function Compile(el, vm) {
    this.$vm = vm
    this.$el = this.isElementNode(el) ? el : document.querySelector(el)
    if (this.$el) {
        // 将根节点的内容(不含根节点)剪切到文档碎片进行操作
        this.$fragment = this.node2Fragment(this.$el)
        // 遍历所有节点及其子节点，进行扫描解析编译
        // 用对应的指令渲染函数进行数据渲染，并调用对应的指令更新函数进行绑定，详看代码及注释说明：
        this.init()
        // 将文档片段移动回原来的真实dom中
        this.$el.appendChild(this.$fragment)
        // 那么如何更新呢？
    } else {
        console.log('挂载点报错' + el + '不是根节点')
    }
}



Compile.prototype = {
    node2Fragment: function (el) {
        var fragment = document.createDocumentFragment()
        var child
        // 将根节点的内容都移动到文档片段里面
        while (child = el.firseChild) {
            fragment.appendChild(child)
        }
        return fragment
    },
    init: function () {
        this.compileElement(this.$fragment)
    },
    compileElement: function (el) {
        var childNodes = el.childNodes
        const me = this
        // 遍历传入元素的子节点（转化为真正的数组）
        [].slice.call(childNodes).forEach(function (node) {
            var text = node.textContent
            var reg = /\{\{(.*)\}\}/
            // 如果是元素节点，就扫描指令，如果是文本节点，就替换响应变量
            if （me.isElementNode(node)) {
                me.compile(node)
            } else if (me.isTextNode(node) && reg.test(text)) {
                // RegExp是全局对象，匹配的第一个
                me.compileText(node, RegExp.$1)
            }
            // 如果当前节点还有子节点，就继续一层层解析指令下去
            if (node.childNodes && node.childNodes.length) {
                me.compileElement(node)
            }
        })
    },
    // 解析单个元素属性上的指令（v-指令，还有'@', ':' ，另外还有事件修饰符）（简化版只解析v-开始的指令）
    compile: function (node) {
        // node.attributes,类数组[{name:xxx, value:xxx}]
        var nodeAttrs = node.attributes
        var me = this
        [].slice.call(nodeAttrs).forEach(function (attr) {
            var attrName = attr.name
            // v-开头的指令
            if (isDirective(arrtName)) {
                // v-on:click dir是v-以后的字符串
                var dir = attrName.slice(2)
                var exp = attr.value
                // 是什么指令，on? html? text? for? if?
                if (isEventDirective(attrName)) {
                    // dom绑定事件，不支持修饰符了
                    compileUtils.eventHandler(node, me.$vm, dir, exp)
                } else {
                    // 其他指令
                    compileUtils[dir] && compileUtils[dir](node, me.$vm, exp)
                }

                node.removeAttribute(attrName)
            }
        })
    },
    compileText: function (node, exp) {
        compileUtils.text(node, this.$vm, exp)
    },
    isTextNode: function (node) {
        return node.nodeType === 3 
    },
    isElementNode: function (node) {
        return node.nodeType === 1
    },
    isEventDirective: function (str) {
        return str.indexOf('on') === 0
    },
    isDirective: function (str) {
        return str.indexOf('v-') === 0
    },
    isProps: function (str) {
        return str.indexOf(':') === 0
    }


}

var compileUtils = {
    // 没有v-if,v-show,v-for指令的编译
    // dir: v-on后的字符串 ':click'
    // exp: 表达式或者回调函数名，目前只支持函数名
    eventHandler: function (node, vm, dir, exp) {
        // 绑定事件回调：
        var eventType = dir.split(':')[1],
            // 为这个节点绑定处理函数，在vm.$options.methods里寻找对应的方法
            fn = vm.$options.methods && vm.$options.methods[exp];

        if (eventType && fn) {
            // fn.bind(vm)，确保函数的this指向vm
            node.addEventListener(eventType, fn.bind(vm), false);
        } else {
            console.log('绑定方法报错')
        }
    },
    // 单向绑定数据，vm.data.exp响应到视图
    bind: function (node, vm, exp, dir) {
        var updaterFn = updater[dir + 'Updater'];
        // 第一次初始化视图
        // 获取vm.data的数据，然后根据不同的指令，为该节点赋值
        updaterFn && updaterFn(node, this._getVMVal(vm, exp));

        // 实例化订阅者，此操作会在对应的属性消息订阅器中添加了该订阅者watcher
        new Watcher(vm, exp, function(value, oldValue) {
            // 一旦属性值有变化，会收到通知执行此更新函数，更新视图
            updaterFn && updaterFn(node, value, oldValue);
        });
    },
    // 其它指令都有响应数据功能
    text: function (node, vm, exp) {
        this.bind(node, vm, exp, 'text');
    },
    html: function (node, vm, exp) {
        this.bind(node, vm, exp, 'html');
    },
    class: function(node, vm, exp) {
        this.bind(node, vm, exp, 'class');
    },
    model: function(node, vm, exp) {
        this.bind(node, vm, exp, 'model');
        // 增加视图到vm.data.exp的数据绑定
        var me = this,
            val = this._getVMVal(vm, exp);
        node.addEventListener('input', function(e) {
            var newValue = e.target.value;
            if (val === newValue) {
                return;
            }

            me._setVMVal(vm, exp, newValue);
            val = newValue; // 这句好像没什么卵用
        });
    },
    // 获取vm.data.exp的值,不支持a[b][c]的形式，exp = 'a.b.c'
    _getVMVal: function (vm, exp) {
        var val = vm;
        exp = exp.split('.');
        exp.forEach(function(k) {
            val = val[k];
        });
        return val;
    },
    _setVMVal: function (vm, exp) {
        var val = vm;
        exp = exp.split('.');
        exp.forEach(function(k, i) {
            // 非最后一个key，更新val的值
            if (i < exp.length - 1) {
                val = val[k];
            } else {
                val[k] = value;
            }
        });
    }
}

var updater = {
    textUpdater: function(node, value) {
        node.textContent = typeof value == 'undefined' ? '' : value;
    },

    htmlUpdater: function(node, value) {
        node.innerHTML = typeof value == 'undefined' ? '' : value;
    },
    // v-class指令：值是字符串，以' '分割
    classUpdater: function(node, value, oldValue) {
        var className = node.className;
        className = className.replace(oldValue, '').replace(/\s$/, '');

        var space = className && String(value) ? ' ' : '';

        node.className = className + space + value;
    },

    modelUpdater: function(node, value, oldValue) {
        node.value = typeof value == 'undefined' ? '' : value;
    }
};