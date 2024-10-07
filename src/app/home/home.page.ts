import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addCircleOutline, logInOutline, trashOutline } from 'ionicons/icons';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { UserInterface } from '../interfaces/user.interface';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import Swal from 'sweetalert2';
import { CommonModule } from '@angular/common';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { Capacitor, Plugins } from '@capacitor/core';

const { App } = Plugins;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    CommonModule,
    IonSelect,
    IonSelectOption,
    NgxSpinnerModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HomePage implements OnInit {
  isSupported = false;
  user: UserInterface | undefined;
  codigo!: string;
  selectedCredits: number | undefined;
  scanning: boolean = false;
  userSubscription!: Subscription;
  scanImage = '';

  constructor(private auth: AuthService, public spinner: NgxSpinnerService) {
    addIcons({ logInOutline, addCircleOutline, trashOutline });
  }

  async ngOnInit() {
    await this.loadUser();
    const result = await BarcodeScanner.isSupported();
    this.isSupported = result.supported;
  }

  async loadUser() {
    this.spinner.show();
    this.auth.getCurrentUser().subscribe(
      (user) => {
        this.user = user;
        this.spinner.hide();
      },
      (error) => {
        this.spinner.hide();
        console.error('Error al cargar el usuario', error);
      }
    );
  }

  onSelectCreditsChange(value: number) {
    this.selectedCredits = Number(value);
    this.scanImage = value.toString();

    switch (Number(value)) {
      case 10:
        this.codigo = '8c95def646b6127282ed50454b73240300dccabc';
        break;
      case 50:
        this.codigo = 'ae338e4e0cbb4e4bcffaf9ce5b409feb8edd5172';
        break;
      case 100:
        this.codigo = '2786f4877b9091dcad7f35751bfcf5d5ea712b2f';
        break;
      default:
        this.codigo = '';
        break;
    }
  }

  async scan(): Promise<void> {
    const granted = await this.requestPermissions();
    if (!granted) {
      await this.presentAlert();
      this.scanning = false;
      return;
    }
    await this.credits();
  }

  async credits() {
    this.scanning = true;

    if (!this.user || !this.selectedCredits || !this.codigo) return;

    const cantidadCargas = this.user.perfil === 'admin' ? 2 : 1;
    const codigoYaUsado = this.countOccurrences(this.user.codes, this.codigo);

    if (codigoYaUsado < cantidadCargas) {
      this.user.credito += this.selectedCredits;
      this.user.codes.push(this.codigo);
      await this.auth.updateUser(this.user);
      Swal.fire({
        heightAuto: false,
        title: 'Créditos acreditados',
        text: `Se han acreditado ${this.selectedCredits} créditos.`,
        icon: 'success',
      });
      this.scanning = true;
    } else {
      Swal.fire({
        heightAuto: false,
        title: 'Código utilizado',
        text: `No puede utilizar más de ${cantidadCargas} vez este código QR`,
        confirmButtonText: 'ok',
      });
      this.scanning = true;
    }
  }

  countOccurrences(arr: string[], value: string): number {
    return arr.reduce(
      (count, current) => (current === value ? count + 1 : count),
      0
    );
  }

  async performReset() {
    if (!this.user) return;

    const confirm = await Swal.fire({
      heightAuto: false,
      title: '¿Estás seguro?',
      text: 'Esto limpiará todos tus créditos acumulados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'No, cancelar',
    });

    if (confirm.isConfirmed) {
      this.user.codes = [];
      this.user.credito = 0;
      await this.auth.updateUser(this.user);
      Swal.fire({
        heightAuto: false,
        title: 'Limpiado',
        text: 'Tus créditos han sido limpiados.',
        confirmButtonText: 'ok',
      });
      this.scanning = false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    const { camera } = await BarcodeScanner.requestPermissions();
    return camera === 'granted' || camera === 'limited';
  }

  async presentAlert(): Promise<void> {
    const result = await Swal.fire({
      heightAuto: false,
      title: 'Permiso denegado',
      text: 'Por favor, otorgue permisos a la aplicación para usar la cámara.',
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'Configuración',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      this.openAppSettings();
    }
  }

  openAppSettings() {
    if (Capacitor.isNativePlatform()) {
      App['openUrl']({ url: 'app-settings:' });
    }
  }

  handleLogout() {
    this.auth.logout();
  }
}
