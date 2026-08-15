"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const container_1 = require("../src/container");
const inject_1 = require("../src/decorators/inject");
const injectable_1 = require("../src/decorators/injectable");
describe('mini-nest', () => {
    let container;
    beforeEach(() => {
        container = new container_1.Container();
    });
    describe('constructor dependencies resolution', () => {
        it('should resolve a simple dependencies graph', () => {
            let ServiceC = class ServiceC {
                constructor() { }
            };
            ServiceC = __decorate([
                (0, injectable_1.Injectable)(),
                __metadata("design:paramtypes", [])
            ], ServiceC);
            let ServiceB = class ServiceB {
                serviceC;
                constructor(serviceC) {
                    this.serviceC = serviceC;
                }
            };
            ServiceB = __decorate([
                (0, injectable_1.Injectable)(),
                __metadata("design:paramtypes", [ServiceC])
            ], ServiceB);
            let ServiceA = class ServiceA {
                serviceB;
                constructor(serviceB) {
                    this.serviceB = serviceB;
                }
            };
            ServiceA = __decorate([
                (0, injectable_1.Injectable)(),
                __metadata("design:paramtypes", [ServiceB])
            ], ServiceA);
            const serviceA = container.resolve(ServiceA);
            expect(serviceA.serviceB).toBeInstanceOf(ServiceB);
            expect(serviceA.serviceB.serviceC).toBeInstanceOf(ServiceC);
        });
        it('should throw an intelligible error if a circular dependency is detected', () => {
            let ServiceC = class ServiceC {
                serviceD;
                constructor(serviceD) {
                    this.serviceD = serviceD;
                }
            };
            ServiceC = __decorate([
                (0, injectable_1.Injectable)(),
                __metadata("design:paramtypes", [Object])
            ], ServiceC);
            let ServiceD = class ServiceD {
                serviceC;
                constructor(serviceC) {
                    this.serviceC = serviceC;
                }
            };
            ServiceD = __decorate([
                (0, injectable_1.Injectable)(),
                __metadata("design:paramtypes", [ServiceC])
            ], ServiceD);
            Reflect.defineMetadata('design:paramtypes', [ServiceD], ServiceC);
            expect(() => container.resolve(ServiceC)).toThrow('Circular dependency detected: ServiceC -> ServiceD -> ServiceC');
        });
    });
    describe('service scopes', () => {
        it('should return the same instance for singleton scoped services', () => {
            let ServiceA = class ServiceA {
                constructor() { }
            };
            ServiceA = __decorate([
                (0, injectable_1.Injectable)({ scope: 'singleton' }),
                __metadata("design:paramtypes", [])
            ], ServiceA);
            const serviceA = container.resolve(ServiceA);
            const serviceA2 = container.resolve(ServiceA);
            expect(serviceA).toBe(serviceA2);
        });
        it('should create a singleton service by default', () => {
            let ServiceA = class ServiceA {
                constructor() { }
            };
            ServiceA = __decorate([
                (0, injectable_1.Injectable)(),
                __metadata("design:paramtypes", [])
            ], ServiceA);
            const serviceA = container.resolve(ServiceA);
            const serviceA2 = container.resolve(ServiceA);
            expect(serviceA).toBe(serviceA2);
        });
        it('should return a new instance for transient scoped services', () => {
            let ServiceA = class ServiceA {
                constructor() { }
            };
            ServiceA = __decorate([
                (0, injectable_1.Injectable)({ scope: 'transient' }),
                __metadata("design:paramtypes", [])
            ], ServiceA);
            const serviceA = container.resolve(ServiceA);
            const serviceA2 = container.resolve(ServiceA);
            expect(serviceA).not.toBe(serviceA2);
        });
    });
    describe('@Inject', () => {
        it('should inject dependency for an argument of interface type', () => {
            const serviceToken = Symbol('IService');
            let ServiceB = class ServiceB {
                name;
                constructor() {
                    this.name = 'ServiceB';
                }
            };
            ServiceB = __decorate([
                (0, injectable_1.Injectable)(),
                __metadata("design:paramtypes", [])
            ], ServiceB);
            container.bind(serviceToken, ServiceB);
            let ServiceA = class ServiceA {
                service;
                constructor(service) {
                    this.service = service;
                }
            };
            ServiceA = __decorate([
                (0, injectable_1.Injectable)(),
                __param(0, (0, inject_1.Inject)(serviceToken)),
                __metadata("design:paramtypes", [Object])
            ], ServiceA);
            const serviceA = container.resolve(ServiceA);
            expect(serviceA.service).toBeInstanceOf(ServiceB);
        });
        it('should throw an intelligible error if @Inject is missing for an argument of interface type', () => {
            const serviceToken = Symbol('IService');
            let ServiceB = class ServiceB {
                name;
                constructor() {
                    this.name = 'ServiceB';
                }
            };
            ServiceB = __decorate([
                (0, injectable_1.Injectable)(),
                __metadata("design:paramtypes", [])
            ], ServiceB);
            container.bind(serviceToken, ServiceB);
            let ServiceA = class ServiceA {
                service;
                constructor(service) {
                    this.service = service;
                }
            };
            ServiceA = __decorate([
                (0, injectable_1.Injectable)(),
                __metadata("design:paramtypes", [Object])
            ], ServiceA);
            expect(() => container.resolve(ServiceA)).toThrow('@Inject is missing on ServiceA#0, but the argument is an interface');
        });
        it('should throw an intelligible error if there is no provider for an argument of interface type', () => {
            const serviceToken = Symbol('IService');
            let ServiceA = class ServiceA {
                service;
                constructor(service) {
                    this.service = service;
                }
            };
            ServiceA = __decorate([
                (0, injectable_1.Injectable)(),
                __param(0, (0, inject_1.Inject)(serviceToken)),
                __metadata("design:paramtypes", [Object])
            ], ServiceA);
            expect(() => container.resolve(ServiceA)).toThrow('No provider found for Symbol(IService)');
        });
    });
    it('should throw an error if @Injectable is missing on a service', () => {
        class ServiceA {
            constructor() { }
        }
        expect(() => container.resolve(ServiceA)).toThrow('@Injectable is missing on ServiceA');
    });
});
