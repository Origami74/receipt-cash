/**
 * Payment Notification Service
 * 
 * Sends browser notifications when payments are received
 * to prompt user to return to app for payout processing
 */

class PaymentNotificationService {
  private permission: NotificationPermission = 'default';

  constructor() {
    this.checkPermission();
  }

  /**
   * Check current notification permission
   */
  private checkPermission(): void {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('🔔 Notifications not supported in this browser');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      if (permission === 'granted') {
        console.log('🔔✅ Notification permission granted');
        return true;
      } else {
        console.log('🔔❌ Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('🔔❌ Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Check if notifications are available and permitted
   */
  canSendNotifications(): boolean {
    return 'Notification' in window && this.permission === 'granted';
  }

  /**
   * Send a notification for a received payment
   */
  async notifyPaymentReceived(amount: number, currency: string = 'sats'): Promise<void> {
    if (!this.canSendNotifications()) {
      console.log('🔔 Cannot send notification - permission not granted');
      return;
    }

    try {
      // Vibrate device if supported
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]); // Short-pause-short pattern
      }

      const notification = new Notification('💰 Payment Received!', {
        body: `You received ${amount} ${currency}. Tap to process payout.`,
        icon: '/receipt-cash-logo.png',
        badge: '/receipt-cash-logo.png',
        tag: 'payment-received', // Replaces previous notifications with same tag
        requireInteraction: true, // Stays visible until user interacts
        data: {
          type: 'payment',
          amount,
          currency,
          timestamp: Date.now()
        }
      });

      // Handle notification click - focus the app
      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Navigate to activity view to show the payment
        if (window.location.pathname !== '/activity') {
          window.location.href = '/activity';
        }
      };

      console.log(`🔔 Notification sent: ${amount} ${currency} received`);
    } catch (error) {
      console.error('🔔❌ Error sending notification:', error);
    }
  }

  /**
   * Send a notification for multiple payments
   */
  async notifyMultiplePayments(count: number, totalAmount: number, currency: string = 'sats'): Promise<void> {
    if (!this.canSendNotifications()) {
      return;
    }

    try {
      // Vibrate device with longer pattern for multiple payments
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]); // Multiple buzzes
      }

      const notification = new Notification('💰 Multiple Payments Received!', {
        body: `You received ${count} payments totaling ${totalAmount} ${currency}. Tap to process payouts.`,
        icon: '/receipt-cash-logo.png',
        badge: '/receipt-cash-logo.png',
        tag: 'payments-received',
        requireInteraction: true,
        data: {
          type: 'multiple-payments',
          count,
          totalAmount,
          currency,
          timestamp: Date.now()
        }
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        
        if (window.location.pathname !== '/activity') {
          window.location.href = '/activity';
        }
      };

      console.log(`🔔 Notification sent: ${count} payments, ${totalAmount} ${currency} total`);
    } catch (error) {
      console.error('🔔❌ Error sending notification:', error);
    }
  }

  /**
   * Send a notification that payouts are ready
   */
  async notifyPayoutsReady(): Promise<void> {
    if (!this.canSendNotifications()) {
      return;
    }

    try {
      const notification = new Notification('✅ Payouts Processed!', {
        body: 'Your payments have been processed and are ready.',
        icon: '/receipt-cash-logo.png',
        badge: '/receipt-cash-logo.png',
        tag: 'payouts-ready',
        requireInteraction: false, // Auto-dismiss after a few seconds
        data: {
          type: 'payouts-ready',
          timestamp: Date.now()
        }
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        
        if (window.location.pathname !== '/activity') {
          window.location.href = '/activity';
        }
      };

      console.log('🔔 Notification sent: Payouts ready');
    } catch (error) {
      console.error('🔔❌ Error sending notification:', error);
    }
  }
}

// Export singleton instance
export const paymentNotificationService = new PaymentNotificationService();