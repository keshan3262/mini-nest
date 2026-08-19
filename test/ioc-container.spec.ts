import { Container } from '../src/container';
import { Inject } from '../src/decorators/inject';
import { Injectable } from '../src/decorators/injectable';

describe('IoC container', () => {
  const container = new Container();

  describe('constructor dependencies resolution', () => {
    it('should resolve a simple dependencies graph', () => {
      @Injectable()
      class ServiceC {
        constructor() {}
      }
  
      @Injectable()
      class ServiceB {
        constructor(public readonly serviceC: ServiceC) {}
      }
  
      @Injectable()
      class ServiceA {
        constructor(public readonly serviceB: ServiceB) {}
      }
  
      const serviceA = container.resolve(ServiceA);
  
      expect(serviceA.serviceB).toBeInstanceOf(ServiceB);
      expect(serviceA.serviceB.serviceC).toBeInstanceOf(ServiceC);
    });

    it('should throw an intelligible error if a circular dependency is detected', () => {
      @Injectable()
      class ServiceC {
        constructor(public readonly serviceD: any) {}
      }
  
      @Injectable()
      class ServiceD {
        constructor(public readonly serviceC: ServiceC) {}
      }
  
      Reflect.defineMetadata('design:paramtypes', [ServiceD], ServiceC);
  
      expect(() => container.resolve(ServiceC)).toThrow('Circular dependency detected: ServiceC -> ServiceD -> ServiceC');
    });
  });

  describe('service scopes', () => {
    it('should return the same instance for singleton scoped services', () => {
      @Injectable({ scope: 'singleton' })
      class ServiceA {
        constructor() {}
      }
  
      const serviceA = container.resolve(ServiceA);
      const serviceA2 = container.resolve(ServiceA);
  
      expect(serviceA).toBe(serviceA2);
    });
  
    it('should create a singleton service by default', () => {
      @Injectable()
      class ServiceA {
        constructor() {}
      }
  
      const serviceA = container.resolve(ServiceA);
      const serviceA2 = container.resolve(ServiceA);
  
      expect(serviceA).toBe(serviceA2);
    });
  
    it('should return a new instance for transient scoped services', () => {
      @Injectable({ scope: 'transient' })
      class ServiceA {
        constructor() {}
      }
  
      const serviceA = container.resolve(ServiceA);
      const serviceA2 = container.resolve(ServiceA);
  
      expect(serviceA).not.toBe(serviceA2);
    });
  });

  describe('@Inject', () => {
    it('should inject dependency for an argument of interface type', () => {
      interface IService {
        name: string;
      }
  
      const serviceToken = Symbol('IService');
  
      @Injectable()
      class ServiceB implements IService {
        name: string;
  
        constructor() {
          this.name = 'ServiceB';
        }
      }
  
      container.bind(serviceToken, ServiceB);
  
      @Injectable()
      class ServiceA {
        constructor(@Inject(serviceToken) public readonly service: IService) {}
      }
      
      const serviceA = container.resolve(ServiceA);
  
      expect(serviceA.service).toBeInstanceOf(ServiceB);
    });

    it('should throw an intelligible error if @Inject is missing for an argument of interface type', () => {
      interface IService {
        name: string;
      }

      const serviceToken = Symbol('IService');

      @Injectable()
      class ServiceB implements IService {
        name: string;
  
        constructor() {
          this.name = 'ServiceB';
        }
      }
      
      container.bind(serviceToken, ServiceB);
      
      @Injectable()
      class ServiceA {
        constructor(public readonly service: IService) {}
      }

      expect(() => container.resolve(ServiceA)).toThrow('@Inject is missing on ServiceA#0, but the argument is an interface');
    });

    it('should throw an intelligible error if there is no provider for an argument of interface type', () => {
      interface IService {
        name: string;
      }

      const serviceToken = Symbol('IService');
      
      @Injectable()
      class ServiceA {
        constructor(@Inject(serviceToken) public readonly service: IService) {}
      }

      expect(() => container.resolve(ServiceA)).toThrow('No provider found for Symbol(IService)');
    });
  })

  it('should throw an error if @Injectable is missing on a service', () => {
    class ServiceA {
      constructor() {}
    }

    expect(() => container.resolve(ServiceA)).toThrow('@Injectable is missing on ServiceA');
  });
});
